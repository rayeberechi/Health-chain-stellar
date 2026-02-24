#![no_std]

mod error;
mod storage;
mod types;

use crate::error::ContractError;
use crate::types::{DataKey, TemperatureReading, TemperatureThreshold};
use soroban_sdk::{contract, contractimpl, Address, Env, Vec};

const PAGE_SIZE: u32 = 20;

#[contract]
pub struct TemperatureContract;

#[contractimpl]
impl TemperatureContract {
    pub fn initialize(env: Env, admin: Address) -> Result<(), ContractError> {
        admin.require_auth();

        if env.storage().instance().has(&DataKey::Admin) {
            return Err(ContractError::AlreadyInitialized);
        }

        storage::set_admin(&env, &admin);
        Ok(())
    }

    pub fn set_threshold(
        env: Env,
        admin: Address,
        unit_id: u64,
        min_celsius_x100: i32,
        max_celsius_x100: i32,
    ) -> Result<(), ContractError> {
        admin.require_auth();

        let stored_admin = storage::get_admin(&env);
        if admin != stored_admin {
            return Err(ContractError::Unauthorized);
        }

        if min_celsius_x100 >= max_celsius_x100 {
            return Err(ContractError::InvalidThreshold);
        }

        let threshold = TemperatureThreshold {
            min_celsius_x100,
            max_celsius_x100,
        };
        storage::set_threshold(&env, unit_id, &threshold);
        Ok(())
    }

    pub fn log_reading(
        env: Env,
        unit_id: u64,
        temperature_celsius_x100: i32,
        timestamp: u64,
    ) -> Result<(), ContractError> {
        let threshold =
            storage::get_threshold(&env, unit_id).ok_or(ContractError::ThresholdNotFound)?;

        let is_violation =
            temperature_celsius_x100 < threshold.min_celsius_x100
                || temperature_celsius_x100 > threshold.max_celsius_x100;

        let reading = TemperatureReading {
            temperature_celsius_x100,
            timestamp,
            is_violation,
        };

        let mut page_num: u32 = 0;
        let position: u32;

        loop {
            let len = storage::get_temp_page_len(&env, unit_id, page_num);
            if len == 0 && page_num > 0 {
                position = 0;
                break;
            }
            if len < PAGE_SIZE {
                position = len;
                break;
            }
            page_num += 1;
        }

        let mut page = storage::get_temp_page(&env, unit_id, page_num);

        while page.len() < position {
            page.push_back(TemperatureReading::default());
        }

        if page.len() == position {
            page.push_back(reading);
        } else {
            page.set(position, reading);
        }

        storage::set_temp_page(&env, unit_id, page_num, &page);
        storage::set_temp_page_len(&env, unit_id, page_num, position + 1);

        Ok(())
    }

    pub fn get_violations(env: Env, unit_id: u64) -> Result<Vec<TemperatureReading>, ContractError> {
        let mut violations = Vec::new(&env);
        let mut page_num: u32 = 0;
        
        loop {
            let page_len = storage::get_temp_page_len(&env, unit_id, page_num);
            if page_len == 0 && page_num > 0 {
                break;
            }
            if page_len == 0 {
                page_num += 1;
                continue;
            }

            let page = storage::get_temp_page(&env, unit_id, page_num);
            for i in 0..page_len {
                let reading = page.get(i).unwrap_or_default();
                if reading.is_violation {
                    violations.push_back(reading);
                }
            }

            page_num += 1;
        }

        Ok(violations)
    }

    /// Get all temperature readings for a blood unit
    pub fn get_readings(env: Env, unit_id: u64) -> Result<Vec<TemperatureReading>, ContractError> {
        let mut all_readings = Vec::new(&env);

        let mut page_num: u32 = 0;
        loop {
            // Get the stored length for this page
            let page_len = storage::get_temp_page_len(&env, unit_id, page_num);

            // If page_len is 0 and we've checked pages before, we're done
            if page_len == 0 && page_num > 0 {
                break;
            }

            // If no entries in this page yet, try next page
            if page_len == 0 {
                page_num += 1;
                continue;
            }

            // Get the page
            let page = storage::get_temp_page(&env, unit_id, page_num);

            // Only iterate up to the stored length, not the full page size
            for i in 0..page_len {
                let reading = page.get(i).unwrap_or_default();
                all_readings.push_back(reading);
            }

            page_num += 1;
        }

        Ok(all_readings)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::testutils::Address as _;

    fn create_test_contract<'a>() -> (Env, Address, TemperatureContractClient<'a>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(TemperatureContract, ());
        let client = TemperatureContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        client.initialize(&admin);

        (env, admin, client)
    }

    #[test]
    fn test_zero_padded_entries_not_returned_as_violations() {
        let (_env, admin, client) = create_test_contract();

        let unit_id = 42u64;
        // Set threshold: min = 200 (2.00°C), max = 600 (6.00°C)
        client.set_threshold(&admin, &unit_id, &200, &600);

        // Log exactly 21 readings (one more than page size of 20)
        for i in 0..21u64 {
            let temp = 400 + (i % 3) as i32; // Vary between 400-402 (all within range)
            let timestamp = 1000 + i;
            client.log_reading(&unit_id, &temp, &timestamp);
        }

        // Get violations
        let violations = client.get_violations(&unit_id);

        // Should have zero violations since all logged readings are within threshold
        assert_eq!(violations.len(), 0, "Expected no violations but got {}", violations.len());
    }

    #[test]
    fn test_page_size_plus_one_with_violation_in_second_page() {
        let (_env, admin, client) = create_test_contract();

        let unit_id = 43u64;
        // Set threshold: min = 200 (2.00°C), max = 600 (6.00°C)
        client.set_threshold(&admin, &unit_id, &200, &600);

        // Log exactly 21 readings
        // First 20 readings: all within range
        for i in 0..20u64 {
            let temp = 400 + (i % 3) as i32; // Within 200-600 range
            let timestamp = 1000 + i;
            client.log_reading(&unit_id, &temp, &timestamp);
        }

        // 21st reading: a violation (too cold)
        client.log_reading(&unit_id, &100, &1020);

        // Get violations
        let violations = client.get_violations(&unit_id);

        // Should have exactly 1 violation
        assert_eq!(violations.len(), 1, "Expected 1 violation but got {}", violations.len());
        assert_eq!(violations.get(0).unwrap().temperature_celsius_x100, 100);
    }

    #[test]
    fn test_multiple_pages_correct_violation_count() {
        let (_env, admin, client) = create_test_contract();

        let unit_id = 44u64;
        // Set threshold: min = 200, max = 600
        client.set_threshold(&admin, &unit_id, &200, &600);

        // Log 50 readings across multiple pages
        let mut expected_violations = 0;
        for i in 0..50u64 {
            let temp = if i % 10 == 9 {
                // Every 10th reading is a violation (too hot)
                expected_violations += 1;
                700
            } else {
                400 // Within range
            };
            let timestamp = 1000 + i;
            client.log_reading(&unit_id, &temp, &timestamp);
        }

        // Get violations
        let violations = client.get_violations(&unit_id);

        // Should have exactly 5 violations (indices 9, 19, 29, 39, 49)
        assert_eq!(
            violations.len() as u64,
            expected_violations,
            "Expected {} violations but got {}",
            expected_violations,
            violations.len()
        );

        // Verify all returned readings are violations
        for violation in violations.iter() {
            let reading = violation;
            assert!(
                reading.is_violation,
                "Returned reading should be marked as violation"
            );
            assert!(
                reading.temperature_celsius_x100 < 200 || reading.temperature_celsius_x100 > 600,
                "Returned reading should actually violate threshold"
            );
        }
    }

    #[test]
    fn test_get_all_readings_ignores_padding() {
        let (_env, admin, client) = create_test_contract();

        let unit_id = 45u64;
        // Set threshold: min = 200, max = 600
        client.set_threshold(&admin, &unit_id, &200, &600);

        // Log exactly 21 readings
        for i in 0..21u64 {
            let temp = 400 + (i % 3) as i32;
            let timestamp = 1000 + i;
            client.log_reading(&unit_id, &temp, &timestamp);
        }

        // Get all readings
        let readings = client.get_readings(&unit_id);

        // Should have exactly 21 readings, not 40 (2 pages)
        assert_eq!(
            readings.len(),
            21,
            "Expected 21 readings but got {}",
            readings.len()
        );

        // Verify none are zero-padded (all should have valid timestamps)
        for reading in readings.iter() {
            assert!(
                reading.timestamp >= 1000 && reading.timestamp < 1021,
                "Reading should have valid timestamp from actual log"
            );
        }
    }

    #[test]
    fn test_threshold_violation_detection_with_zero_temp() {
        let (_env, admin, client) = create_test_contract();

        let unit_id = 46u64;
        // Set threshold: min = 200, max = 600
        client.set_threshold(&admin, &unit_id, &200, &600);

        // Log exactly 21 readings (21st will be in second page with padding)
        for i in 0..21u64 {
            let temp = 400;
            let timestamp = 1000 + i;
            client.log_reading(&unit_id, &temp, &timestamp);
        }

        // Verify the second page still exists but has no padding pollution
        let violations = client.get_violations(&unit_id);
        assert_eq!(violations.len(), 0, "No readings should be violations");

        let all_readings = client.get_readings(&unit_id);
        assert_eq!(all_readings.len(), 21, "Should have exactly 21 readings");

        // Verify the 21st reading is not a default/zero-padded entry
        let last_reading = all_readings.get(20).unwrap();
        assert_eq!(last_reading.temperature_celsius_x100, 400, "21st reading should be valid");
        assert_eq!(last_reading.timestamp, 1020, "21st reading should have correct timestamp");
    }
}

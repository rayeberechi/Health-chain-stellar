use crate::error::ContractError;
use crate::storage::{MAX_EXPIRATION_DAYS, SECONDS_PER_DAY};
use crate::types::BloodStatus;
use soroban_sdk::Env;

/// Validate blood registration parameters
///
/// Checks:
/// - Quantity is within acceptable range (100-600ml)
/// - Expiration is in the future but not too far (max 42 days for whole blood)
/// - Expiration is reasonable relative to current time
pub fn validate_blood_registration(
    env: &Env,
    quantity_ml: u32,
    expiration_timestamp: u64,
) -> Result<(), ContractError> {
    // Validate quantity (typical range: 100-600ml)
    if quantity_ml < 100 || quantity_ml > 600 {
        return Err(ContractError::InvalidQuantity);
    }

    let current_time = env.ledger().timestamp();

    // Expiration must be in the future
    if expiration_timestamp <= current_time {
        return Err(ContractError::InvalidExpiration);
    }

    // Expiration shouldn't be too far in the future
    // Standard whole blood shelf life is 42 days
    let max_expiration = current_time + (MAX_EXPIRATION_DAYS * SECONDS_PER_DAY);
    if expiration_timestamp > max_expiration {
        return Err(ContractError::InvalidExpiration);
    }

    Ok(())
}

/// Validate that expiration timestamp is reasonable
/// Should be at least 1 day in the future for practical use
pub fn validate_minimum_shelf_life(
    env: &Env,
    expiration_timestamp: u64,
) -> Result<(), ContractError> {
    let current_time = env.ledger().timestamp();
    let min_shelf_life = current_time + SECONDS_PER_DAY; // At least 1 day

    if expiration_timestamp < min_shelf_life {
        return Err(ContractError::InvalidExpiration);
    }

    Ok(())
}

/// Validate status transition is allowed according to state machine
pub fn validate_status_transition(
    current_status: BloodStatus,
    new_status: BloodStatus,
) -> Result<(), ContractError> {
    if !current_status.can_transition_to(&new_status) {
        return Err(ContractError::InvalidStatusTransition);
    }
    Ok(())
}

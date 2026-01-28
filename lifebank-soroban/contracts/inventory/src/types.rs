use crate::error::ContractError;
use soroban_sdk::{contracttype, Address, Map, String, Symbol, Vec};

/// Blood type enumeration supporting all major blood groups
///
/// Each variant represents a unique combination of ABO and Rh blood typing:
/// - A+, A-: Type A with positive/negative Rh factor
/// - B+, B-: Type B with positive/negative Rh factor  
/// - AB+, AB-: Type AB with positive/negative Rh factor
/// - O+, O-: Type O with positive/negative Rh factor
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
pub enum BloodType {
    /// Type A positive (A+)
    APositive,
    /// Type A negative (A-)
    ANegative,
    /// Type B positive (B+)
    BPositive,
    /// Type B negative (B-)
    BNegative,
    /// Type AB positive (AB+) - Universal plasma donor
    ABPositive,
    /// Type AB negative (AB-)
    ABNegative,
    /// Type O positive (O+)
    OPositive,
    /// Type O negative (O-) - Universal blood donor
    ONegative,
}

/// Blood unit status representing its current state in the supply chain
///
/// Status transitions follow this flow:
/// Available -> Reserved -> InTransit -> Delivered
///           \-> Expired (can happen at any stage)
#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq, Copy)]
pub enum BloodStatus {
    /// Available for reservation - initial state after donation processing
    Available,
    /// Reserved for a specific request but not yet shipped
    Reserved,
    /// Currently being transported to destination
    InTransit,
    /// Successfully delivered to recipient/hospital
    Delivered,
    /// Expired and no longer usable (typically after 42 days for whole blood)
    Expired,
}

/// Complete blood unit record stored in the inventory contract
///
/// Represents a single unit of donated blood with full tracking information
/// from donation through delivery or expiration.
///
/// # Storage Keys
/// - Primary key: `id` (u64)
/// - Secondary indexes: `blood_type`, `bank_id`, `status`
#[contracttype]
#[derive(Clone, Debug)]
pub struct BloodUnit {
    /// Unique identifier for this blood unit
    pub id: u64,

    /// Blood type (A+, A-, B+, B-, AB+, AB-, O+, O-)
    pub blood_type: BloodType,

    /// Volume in milliliters (ml)
    /// Standard unit: 450ml ± 10% for whole blood
    /// Typical range: 400-500ml
    pub quantity_ml: u32,

    /// Blood bank address that manages this unit
    pub bank_id: Address,

    /// Optional donor address (may be anonymous)
    /// None indicates anonymous donation
    pub donor_id: Option<Address>,

    /// Unix timestamp (seconds) when donation was collected
    pub donation_timestamp: u64,

    /// Unix timestamp (seconds) when unit expires
    /// Typically 42 days from donation for whole blood
    /// 5 days for platelets, 1 year for frozen plasma
    pub expiration_timestamp: u64,

    /// Current status in supply chain
    pub status: BloodStatus,

    /// Extensible metadata for additional attributes
    /// Examples: test_results, storage_location, lot_number, processing_notes
    pub metadata: Map<Symbol, String>,
}

impl BloodType {
    /// Check if this blood type can donate to the recipient blood type
    ///
    /// Based on compatibility rules:
    /// - O- can donate to all types (universal donor)
    /// - AB+ can receive from all types (universal recipient)
    /// - Rh- can donate to Rh+ and Rh-
    /// - Rh+ can only donate to Rh+
    pub fn can_donate_to(&self, recipient: &BloodType) -> bool {
        use BloodType::*;

        match (self, recipient) {
            // O- is universal donor
            (ONegative, _) => true,

            // O+ can donate to all positive types
            (OPositive, APositive | BPositive | ABPositive | OPositive) => true,

            // A- can donate to A and AB (both + and -)
            (ANegative, APositive | ANegative | ABPositive | ABNegative) => true,

            // A+ can donate to A+ and AB+
            (APositive, APositive | ABPositive) => true,

            // B- can donate to B and AB (both + and -)
            (BNegative, BPositive | BNegative | ABPositive | ABNegative) => true,

            // B+ can donate to B+ and AB+
            (BPositive, BPositive | ABPositive) => true,

            // AB- can donate to AB+ and AB-
            (ABNegative, ABPositive | ABNegative) => true,

            // AB+ can only donate to AB+
            (ABPositive, ABPositive) => true,

            // All other combinations are incompatible
            _ => false,
        }
    }
}

impl BloodStatus {
    /// Check if transition from current status to new status is valid
    ///
    /// Valid transitions:
    /// - Available -> Reserved, Expired
    /// - Reserved -> InTransit, Available (if cancelled), Expired
    /// - InTransit -> Delivered, Expired
    /// - Delivered -> (terminal state)
    /// - Expired -> (terminal state)
    pub fn can_transition_to(&self, new_status: &BloodStatus) -> bool {
        use BloodStatus::*;

        match (self, new_status) {
            // Available can go to Reserved or Expired
            (Available, Reserved) => true,
            (Available, Expired) => true,

            // Reserved can go to InTransit, back to Available, or Expired
            (Reserved, InTransit) => true,
            (Reserved, Available) => true,
            (Reserved, Expired) => true,

            // InTransit can go to Delivered or Expired
            (InTransit, Delivered) => true,
            (InTransit, Expired) => true,

            // Delivered and Expired are terminal states
            (Delivered, _) => false,
            (Expired, _) => false,

            // No other transitions allowed
            _ => false,
        }
    }

    /// Check if this status is a terminal state
    pub fn is_terminal(&self) -> bool {
        matches!(self, BloodStatus::Delivered | BloodStatus::Expired)
    }
}

impl BloodUnit {
    /// Validate that the blood unit data is consistent and valid
    ///
    /// Checks:
    /// - Quantity is within acceptable range (100-600ml)
    /// - Expiration is after donation
    /// - Timestamps are reasonable (not in far future)
    pub fn validate(&self, current_time: u64) -> Result<(), ContractError> {
        // Validate quantity (typical range: 100-600ml)
        if self.quantity_ml < 100 || self.quantity_ml > 600 {
            return Err(ContractError::InvalidQuantity);
        }

        // Validate timestamps
        if self.expiration_timestamp <= self.donation_timestamp {
            return Err(ContractError::InvalidTimestamp);
        }

        // Donation shouldn't be from far future (allow up to 1 hour ahead for clock skew)
        if self.donation_timestamp > current_time + 3600 {
            return Err(ContractError::InvalidTimestamp);
        }

        Ok(())
    }

    /// Check if blood unit is currently expired
    pub fn is_expired(&self, current_time: u64) -> bool {
        current_time >= self.expiration_timestamp
    }

    /// Calculate shelf life remaining in seconds
    pub fn shelf_life_remaining(&self, current_time: u64) -> i64 {
        (self.expiration_timestamp as i64) - (current_time as i64)
    }
}

/// Storage key types for efficient querying
#[contracttype]
#[derive(Clone, Debug)]
pub enum DataKey {
    /// Individual blood unit by ID
    BloodUnit(u64),

    /// Counter for generating new blood unit IDs
    BloodUnitCounter,

    /// Index: Blood type -> Vec<u64> (blood unit IDs)
    BloodTypeIndex(BloodType),

    /// Index: Bank ID -> Vec<u64> (blood unit IDs)
    BankIndex(Address),

    /// Index: Status -> Vec<u64> (blood unit IDs)
    StatusIndex(BloodStatus),

    /// Index: Donor ID -> Vec<u64> (blood unit IDs)
    DonorIndex(Address),

    /// Admin address
    Admin,

    /// Status change history for a blood unit
    StatusHistory(u64), // u64 is blood_unit_id -> Vec<StatusChangeHistory>

    /// Counter for status change history records
    StatusHistoryCounter,

    /// Counter for status changes on specific blood unit
    BloodUnitStatusChangeCount(u64), // u64 is blood_unit_id
}

#[contracttype]
#[derive(Clone, Debug)]
pub struct BloodRegisteredEvent {
    /// Unique ID of the registered blood unit
    pub blood_unit_id: u64,

    /// Blood bank that registered the unit
    pub bank_id: Address,

    /// Blood type
    pub blood_type: BloodType,

    /// Quantity in milliliters
    pub quantity_ml: u32,

    /// When the unit expires
    pub expiration_timestamp: u64,

    /// When the unit was registered
    pub registered_at: u64,
}

/// Event emitted when blood unit status changes
#[contracttype]
#[derive(Clone, Debug)]
pub struct StatusChangeEvent {
    /// Unique ID of the blood unit
    pub blood_unit_id: u64,

    /// Previous status
    pub from_status: BloodStatus,

    /// New status
    pub to_status: BloodStatus,

    /// Who authorized this change
    pub authorized_by: Address,

    /// When the status change occurred
    pub changed_at: u64,

    /// Optional reason for status change (e.g., "Delivered to Hospital A")
    pub reason: Option<String>,
}

/// Historical record of a status change
#[contracttype]
#[derive(Clone, Debug)]
pub struct StatusChangeHistory {
    /// Unique ID for this history record
    pub id: u64,

    /// Blood unit ID
    pub blood_unit_id: u64,

    /// Previous status
    pub from_status: BloodStatus,

    /// New status
    pub to_status: BloodStatus,

    /// Who authorized this change
    pub authorized_by: Address,

    /// When the status change occurred
    pub changed_at: u64,

    /// Optional reason for status change
    pub reason: Option<String>,
}

/// Batch status update operation
#[contracttype]
#[derive(Clone, Debug)]
pub struct BatchStatusUpdate {
    /// List of blood unit IDs to update
    pub blood_unit_ids: Vec<u64>,

    /// New status for all units
    pub new_status: BloodStatus,

    /// Optional reason for batch update
    pub reason: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use soroban_sdk::{testutils::Address as _, Env};

    #[test]
    fn test_blood_type_compatibility_universal_donor() {
        let o_neg = BloodType::ONegative;

        // O- can donate to all types
        assert!(o_neg.can_donate_to(&BloodType::ONegative));
        assert!(o_neg.can_donate_to(&BloodType::OPositive));
        assert!(o_neg.can_donate_to(&BloodType::ANegative));
        assert!(o_neg.can_donate_to(&BloodType::APositive));
        assert!(o_neg.can_donate_to(&BloodType::BNegative));
        assert!(o_neg.can_donate_to(&BloodType::BPositive));
        assert!(o_neg.can_donate_to(&BloodType::ABNegative));
        assert!(o_neg.can_donate_to(&BloodType::ABPositive));
    }

    #[test]
    fn test_blood_type_compatibility_universal_recipient() {
        let ab_pos = BloodType::ABPositive;

        // AB+ can receive from all types
        assert!(BloodType::ONegative.can_donate_to(&ab_pos));
        assert!(BloodType::OPositive.can_donate_to(&ab_pos));
        assert!(BloodType::ANegative.can_donate_to(&ab_pos));
        assert!(BloodType::APositive.can_donate_to(&ab_pos));
        assert!(BloodType::BNegative.can_donate_to(&ab_pos));
        assert!(BloodType::BPositive.can_donate_to(&ab_pos));
        assert!(BloodType::ABNegative.can_donate_to(&ab_pos));
        assert!(BloodType::ABPositive.can_donate_to(&ab_pos));
    }

    #[test]
    fn test_blood_type_compatibility_specific_cases() {
        // A+ can donate to A+ and AB+
        assert!(BloodType::APositive.can_donate_to(&BloodType::APositive));
        assert!(BloodType::APositive.can_donate_to(&BloodType::ABPositive));
        assert!(!BloodType::APositive.can_donate_to(&BloodType::ANegative));
        assert!(!BloodType::APositive.can_donate_to(&BloodType::BPositive));

        // B- can donate to B+, B-, AB+, AB-
        assert!(BloodType::BNegative.can_donate_to(&BloodType::BPositive));
        assert!(BloodType::BNegative.can_donate_to(&BloodType::BNegative));
        assert!(BloodType::BNegative.can_donate_to(&BloodType::ABPositive));
        assert!(BloodType::BNegative.can_donate_to(&BloodType::ABNegative));
        assert!(!BloodType::BNegative.can_donate_to(&BloodType::APositive));
    }

    #[test]
    fn test_status_transitions_valid() {
        use BloodStatus::*;

        // Available transitions
        assert!(Available.can_transition_to(&Reserved));
        assert!(Available.can_transition_to(&Expired));
        assert!(!Available.can_transition_to(&InTransit));
        assert!(!Available.can_transition_to(&Delivered));

        // Reserved transitions
        assert!(Reserved.can_transition_to(&InTransit));
        assert!(Reserved.can_transition_to(&Available));
        assert!(Reserved.can_transition_to(&Expired));
        assert!(!Reserved.can_transition_to(&Delivered));

        // InTransit transitions
        assert!(InTransit.can_transition_to(&Delivered));
        assert!(InTransit.can_transition_to(&Expired));
        assert!(!InTransit.can_transition_to(&Available));
        assert!(!InTransit.can_transition_to(&Reserved));

        // Terminal states
        assert!(!Delivered.can_transition_to(&Expired));
        assert!(!Expired.can_transition_to(&Delivered));
    }

    #[test]
    fn test_status_terminal_states() {
        assert!(BloodStatus::Delivered.is_terminal());
        assert!(BloodStatus::Expired.is_terminal());
        assert!(!BloodStatus::Available.is_terminal());
        assert!(!BloodStatus::Reserved.is_terminal());
        assert!(!BloodStatus::InTransit.is_terminal());
    }

    #[test]
    fn test_blood_unit_validation_valid() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let current_time = 1000u64;

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 450,
            bank_id: bank,
            donor_id: None,
            donation_timestamp: current_time,
            expiration_timestamp: current_time + (42 * 24 * 60 * 60), // 42 days
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        assert!(unit.validate(current_time).is_ok());
    }

    #[test]
    fn test_blood_unit_validation_invalid_quantity_too_low() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let current_time = 1000u64;

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 50, // Too low
            bank_id: bank,
            donor_id: None,
            donation_timestamp: current_time,
            expiration_timestamp: current_time + (42 * 24 * 60 * 60),
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        assert_eq!(
            unit.validate(current_time),
            Err(ContractError::InvalidQuantity)
        );
    }

    #[test]
    fn test_blood_unit_validation_invalid_quantity_too_high() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let current_time = 1000u64;

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 700, // Too high
            bank_id: bank,
            donor_id: None,
            donation_timestamp: current_time,
            expiration_timestamp: current_time + (42 * 24 * 60 * 60),
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        assert_eq!(
            unit.validate(current_time),
            Err(ContractError::InvalidQuantity)
        );
    }

    #[test]
    fn test_blood_unit_validation_expiration_before_donation() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let current_time = 1000u64;

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 450,
            bank_id: bank,
            donor_id: None,
            donation_timestamp: current_time,
            expiration_timestamp: current_time - 100, // Before donation
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        assert_eq!(
            unit.validate(current_time),
            Err(ContractError::InvalidTimestamp)
        );
    }

    #[test]
    fn test_blood_unit_validation_future_donation() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let current_time = 1000u64;

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 450,
            bank_id: bank,
            donor_id: None,
            donation_timestamp: current_time + 7200, // 2 hours in future
            expiration_timestamp: current_time + (42 * 24 * 60 * 60),
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        assert_eq!(
            unit.validate(current_time),
            Err(ContractError::InvalidTimestamp)
        );
    }

    #[test]
    fn test_blood_unit_is_expired() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let donation_time = 1000u64;
        let expiration_time = donation_time + (42 * 24 * 60 * 60);

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 450,
            bank_id: bank,
            donor_id: None,
            donation_timestamp: donation_time,
            expiration_timestamp: expiration_time,
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        // Not expired before expiration time
        assert!(!unit.is_expired(expiration_time - 1));

        // Expired at expiration time
        assert!(unit.is_expired(expiration_time));

        // Expired after expiration time
        assert!(unit.is_expired(expiration_time + 100));
    }

    #[test]
    fn test_blood_unit_shelf_life_remaining() {
        let env = Env::default();
        let bank = Address::generate(&env);
        let donation_time = 1000u64;
        let expiration_time = donation_time + 3600; // 1 hour

        let unit = BloodUnit {
            id: 1,
            blood_type: BloodType::APositive,
            quantity_ml: 450,
            bank_id: bank,
            donor_id: None,
            donation_timestamp: donation_time,
            expiration_timestamp: expiration_time,
            status: BloodStatus::Available,
            metadata: Map::new(&env),
        };

        // 30 minutes before expiration
        assert_eq!(unit.shelf_life_remaining(donation_time + 1800), 1800);

        // At expiration
        assert_eq!(unit.shelf_life_remaining(expiration_time), 0);

        // 10 minutes past expiration
        assert_eq!(unit.shelf_life_remaining(expiration_time + 600), -600);
    }
}

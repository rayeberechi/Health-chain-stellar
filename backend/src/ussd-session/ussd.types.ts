export enum UssdStep {
  LOGIN_PHONE = 'LOGIN_PHONE',
  LOGIN_PIN = 'LOGIN_PIN',
  SELECT_BLOOD_TYPE = 'SELECT_BLOOD_TYPE',
  SELECT_QUANTITY = 'SELECT_QUANTITY',
  SELECT_BLOOD_BANK = 'SELECT_BLOOD_BANK',
  CONFIRM_ORDER = 'CONFIRM_ORDER',
  ORDER_PLACED = 'ORDER_PLACED',
}

export enum BloodType {
  A_POS = 'A+',
  A_NEG = 'A-',
  B_POS = 'B+',
  B_NEG = 'B-',
  AB_POS = 'AB+',
  AB_NEG = 'AB-',
  O_POS = 'O+',
  O_NEG = 'O-',
}

export interface UssdSession {
  sessionId: string;
  phoneNumber: string;
  step: UssdStep;
  userId?: string;
  selectedBloodType?: string;
  selectedQuantity?: number;
  selectedBloodBankId?: string;
  selectedBloodBankName?: string;
  history: UssdStep[];
  createdAt: number;
  updatedAt: number;
}

export interface UssdRequest {
  sessionId: string;
  serviceCode: string;
  phoneNumber: string;
  text: string;
  networkCode?: string;
  operator?: string;
}

export interface UssdResponse {
  type: 'CON' | 'END';
  message: string;
}

export interface BloodBank {
  id: string;
  name: string;
  available: boolean;
}

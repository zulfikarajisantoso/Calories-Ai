export interface NutritionalData {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes: string;
}

export interface MealEntry {
  id: string;
  timestamp: number;
  imageUrl?: string; // Base64 or URL
  textInput?: string;
  data: NutritionalData;
}

export enum UserPlan {
  FREE = 'FREE',
  PRO = 'PRO'
}

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  plan: UserPlan;
  avatarUrl: string;
  dailyUsageCount: number;
  lastUsageDate: string; // ISO Date string YYYY-MM-DD
}

export interface ChartData {
  name: string;
  value: number;
  fill: string;
  [key: string]: string | number;
}
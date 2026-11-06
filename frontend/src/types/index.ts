// Shared TypeScript types for the Turf Booking application.
// Import from '@/types' in any component, hook, or page.

// ─── Users ───────────────────────────────────────────────────────────────────

export type UserRole = 'super_admin' | 'owner' | 'user';

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  status?: 'active' | 'disabled';
  created_at?: string;
}

// ─── Turfs ───────────────────────────────────────────────────────────────────

export type TurfStatus = 'pending' | 'approved' | 'rejected' | 'deleted';

export interface Turf {
  id: number;
  owner_id: number;
  name: string;
  description?: string;
  location: string;
  city: string;
  sport_type: string;
  facilities: string[];
  images: string[];
  status: TurfStatus;
  rejection_reason?: string;
  part_payment_percentage: number;
  base_price?: number;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  created_at?: string;
}

// ─── Slots ───────────────────────────────────────────────────────────────────

export type SlotStatus = 'available' | 'blocked' | 'booked';

export interface Slot {
  id: number;
  turf_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: SlotStatus;
  block_reason?: string;
  price_per_hour?: number;
  base_price?: number;
  custom_multiplier?: number;
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export type BookingStatus = 'pending' | 'confirmed' | 'cancelled' | 'failed';
export type PaymentStatus = 'unpaid' | 'partially_paid' | 'fully_paid';
export type PaymentType = 'full' | 'part';

export interface Booking {
  id: number;
  slot_id: number;
  user_id: number;
  turf_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  duration_hours: number;
  price_per_hour: number;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
  payment_type: PaymentType;
  payment_status: PaymentStatus;
  status: BookingStatus;
  razorpay_order_id?: string;
  payment_id?: string;
  notes?: string;
  cancellation_reason?: string;
  created_at?: string;
  // Joined fields
  turf_name?: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
}

// ─── Pricing ─────────────────────────────────────────────────────────────────

export type PricingRuleType = 'base' | 'custom';

export interface PricingRule {
  id: number;
  turf_id: number;
  rule_type: PricingRuleType;
  day_of_week?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  multiplier: number;
  price_per_hour?: number;
  label?: string;
  created_at?: string;
}

// ─── Subscriptions ───────────────────────────────────────────────────────────

export type SubscriptionTier = 'starter' | 'pro';
export type BillingInterval = 'month' | 'year';

export interface Plan {
  id: number;
  code: string;
  name: string;
  tier: SubscriptionTier;
  billing_interval: BillingInterval;
  price: number;
  max_turfs?: number | null;
  allow_booking_links: boolean;
  is_active: boolean;
  sort_order: number;
}

export interface Subscription {
  id: number;
  owner_id: number;
  plan_id?: number;
  plan_name: string;
  plan_code?: string;
  tier?: SubscriptionTier;
  amount: number;
  status: 'pending' | 'active' | 'expired' | 'cancelled';
  is_trial: boolean;
  start_date: string;
  end_date: string;
  razorpay_order_id?: string;
  razorpay_payment_id?: string;
  max_turfs?: number;
  allow_booking_links?: boolean;
}

// ─── Payouts ─────────────────────────────────────────────────────────────────

export type PayoutStatus = 'pending' | 'processed' | 'failed';

export interface Payout {
  id: number;
  owner_id: number;
  amount: number;
  platform_fee: number;
  final_amount: number;
  status: PayoutStatus;
  payout_mode: 'bank_account' | 'upi';
  payout_type: 'manual' | 'auto';
  transaction_ref: string;
  razorpay_fund_account_id?: string;
  razorpay_payout_id?: string;
  failure_reason?: string;
  period_start: string;
  period_end: string;
  processed_at?: string;
  created_at?: string;
  // Joined
  owner_name?: string;
  owner_email?: string;
}

// ─── API Helpers ─────────────────────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  message: string;
  errors?: { msg: string; path: string }[];
  code?: string;
}

// ─── Razorpay ────────────────────────────────────────────────────────────────

export interface RazorpayOrder {
  id: string;
  amount: number;
  currency: string;
  receipt: string;
}

export interface RazorpayPaymentResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}


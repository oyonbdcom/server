export interface IScheduleResponse {
  id: string;
  membershipId: string;
  days: string[];
  times: string;
  note?: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

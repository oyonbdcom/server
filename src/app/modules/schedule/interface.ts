export interface IScheduleResponse {
  id: string;
  membershipId: string;
  days: string[];
  startTime: string;
  endTime: string;
  createdAt: Date | string;
  updatedAt: Date | string;
}

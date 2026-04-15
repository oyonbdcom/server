export interface IDepartmentResponse {
  id: string;
  name: string;
  slug: string;
  image: string | null;
}

export interface IAreaResponse {
  id: string;
  name: string;
  slug: string;
  districtId: string;
  district?: {
    id: string;
    name: string;
  };
}

export interface IDoctorAreaResponse {
  areaId: string;
  area: IAreaResponse;
}

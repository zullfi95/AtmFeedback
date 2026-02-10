export interface User {
  id: string;
  username: string;
  email?: string;
  role: string;
  companyId?: string;
  company?: {
    id: string;
    name: string;
  };
  assignedPoints?: Array<{
    servicePoint: {
      id: string;
      name: string;
      type: string;
      address: string;
    };
  }>;
}

export interface Company {
  id: string;
  name: string;
  description?: string;
  address?: string;
  _count?: {
    users: number;
    servicePoints: number;
  };
  servicePoints?: ServicePoint[];
  users?: Array<{
    id: string;
    username: string;
    role: string;
    assignedPoints?: Array<{
      servicePoint: {
        id: string;
        name: string;
        type: string;
      };
    }>;
  }>;
}

export interface ServicePoint {
  id: string;
  name: string;
  type: 'ATM' | 'BUS_STOP';
  address: string;
  latitude: number;
  longitude: number;
  companyId: string;
  company: {
    id: string;
    name: string;
  };
}

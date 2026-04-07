export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string;
  members: string[];
}

export interface TestCaseStep {
  id: string;
  text: string;
  imageUrl?: string;
  order: number;
}

export interface TestCase {
  id: string;
  projectId: string;
  title: string;
  description: string;
  parentId: string | null;
  childIds: string[];
  order: number;
  steps: TestCaseStep[];
  status: 'pending' | 'pass' | 'fail';
  createdAt: Date;
  updatedAt: Date;
  checkedAt: Date | null;
  createdBy: string;
  updatedBy: string;
  checkedBy: string | null;
}

export interface Comment {
  id: string;
  testCaseId: string;
  userId: string;
  userName: string;
  userAvatar: string;
  text: string;
  type: 'comment' | 'bug';
  attachments: Attachment[];
  createdAt: Date;
}

export interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'log';
}

export interface OnlineUser {
  uid: string;
  displayName: string;
  photoURL: string;
  projectId: string;
  testCaseId?: string;
  lastSeen: Date;
}

export type Language = 'th' | 'en';
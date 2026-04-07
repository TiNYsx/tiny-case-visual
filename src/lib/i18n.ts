'use client';

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

const resources = {
  th: {
    translation: {
      app: { name: 'TestCase Visual', tagline: 'เครื่องมือจัดการ Test Case' },
      nav: { dashboard: 'แดชบอร์ด', projects: 'โปรเจกต์', settings: 'การตั้งค่า', logout: 'ออกจากระบบ' },
      auth: { login: 'เข้าสู่ระบบ', loginWithGoogle: 'เข้าสู่ระบบด้วย Google', welcome: 'ยินดีต้อนรับ', welcomeDesc: 'เข้าสู่ระบบเพื่อเริ่มจัดการ Test Case ของคุณ' },
      project: { title: 'โปรเจกต์', create: 'สร้างโปรเจกต์', edit: 'แก้ไขโปรเจกต์', delete: 'ลบโปรเจกต์', name: 'ชื่อโปรเจกต์', description: 'รายละเอียด', createdAt: 'สร้างเมื่อ', updatedAt: 'อัปเดตเมื่อ', members: 'สมาชิก', testCases: 'Test Cases', noProjects: 'ยังไม่มีโปรเจกต์', createFirst: 'สร้างโปรเจกต์แรกของคุณ', confirmDelete: 'คุณแน่ใจหรือไม่ที่จะลบโปรเจกต์นี้?' },
      testCase: { title: 'Test Case', create: 'สร้าง Test Case', edit: 'แก้ไข Test Case', delete: 'ลบ Test Case', name: 'ชื่อ Test Case', description: 'รายละเอียด', steps: 'ขั้นตอน', addStep: 'เพิ่มขั้นตอน', stepText: 'รายละเอียดขั้นตอน', uploadImage: 'อัปโหลดรูปภาพ', status: 'สถานะ', pending: 'รอตรวจสอบ', pass: 'ผ่าน', fail: 'ไม่ผ่าน', markPass: 'ทำเครื่องหมายผ่าน', markFail: 'ทำเครื่องหมายไม่ผ่าน', checkedAt: 'ตรวจสอบเมื่อ', checkedBy: 'ตรวจสอบโดย', parent: 'Test Case หลัก', noParent: 'ไม่มี (Root)', confirmDelete: 'คุณแน่ใจหรือไม่ที่จะลบ Test Case นี้?', details: 'รายละเอียด', comments: 'ความคิดเห็น' },
      comment: { title: 'ความคิดเห็น', add: 'เพิ่มความคิดเห็น', type: 'ประเภท', normal: 'ความคิดเห็น', bug: 'รายงาน Bug', placeholder: 'เขียนความคิดเห็น...', attachFile: 'แนบไฟล์', submit: 'ส่ง' },
      common: { save: 'บันทึก', cancel: 'ยกเลิก', confirm: 'ยืนยัน', delete: 'ลบ', edit: 'แก้ไข', close: 'ปิด', loading: 'กำลังโหลด...', error: 'เกิดข้อผิดพลาด', success: 'สำเร็จ', online: 'ออนไลน์', offline: 'ออฟไลน์' },
      realtime: { usersOnline: 'ผู้ใช้ที่ออนไลน์', viewing: 'กำลังดู', editing: 'กำลังแก้ไข' },
    },
  },
  en: {
    translation: {
      app: { name: 'TestCase Visual', tagline: 'Test Case Management Tool' },
      nav: { dashboard: 'Dashboard', projects: 'Projects', settings: 'Settings', logout: 'Logout' },
      auth: { login: 'Login', loginWithGoogle: 'Login with Google', welcome: 'Welcome', welcomeDesc: 'Login to start managing your Test Cases' },
      project: { title: 'Project', create: 'Create Project', edit: 'Edit Project', delete: 'Delete Project', name: 'Project Name', description: 'Description', createdAt: 'Created At', updatedAt: 'Updated At', members: 'Members', testCases: 'Test Cases', noProjects: 'No projects yet', createFirst: 'Create your first project', confirmDelete: 'Are you sure you want to delete this project?' },
      testCase: { title: 'Test Case', create: 'Create Test Case', edit: 'Edit Test Case', delete: 'Delete Test Case', name: 'Test Case Name', description: 'Description', steps: 'Steps', addStep: 'Add Step', stepText: 'Step Details', uploadImage: 'Upload Image', status: 'Status', pending: 'Pending', pass: 'Pass', fail: 'Fail', markPass: 'Mark as Pass', markFail: 'Mark as Fail', checkedAt: 'Checked At', checkedBy: 'Checked By', parent: 'Parent Test Case', noParent: 'None (Root)', confirmDelete: 'Are you sure you want to delete this test case?', details: 'Details', comments: 'Comments' },
      comment: { title: 'Comments', add: 'Add Comment', type: 'Type', normal: 'Comment', bug: 'Bug Report', placeholder: 'Write a comment...', attachFile: 'Attach File', submit: 'Submit' },
      common: { save: 'Save', cancel: 'Cancel', confirm: 'Confirm', delete: 'Delete', edit: 'Edit', close: 'Close', loading: 'Loading...', error: 'Error', success: 'Success', online: 'Online', offline: 'Offline' },
      realtime: { usersOnline: 'Users Online', viewing: 'Viewing', editing: 'Editing' },
    },
  },
};

i18n
  .use(initReactI18next)
  .init({
    resources,
    lng: 'th',
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
  });

export default i18n;
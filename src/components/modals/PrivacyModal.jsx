import React from 'react';
import { X } from 'lucide-react';

const PrivacyModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 shrink-0">
        <h3 className="font-bold text-lg text-gray-800">개인정보처리방침</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-600 space-y-4 text-left">
        <p className="font-bold text-gray-800">1. 수집하는 개인정보의 항목</p>
        <p>회사는 회원가입, 원활한 고객상담, 각종 서비스의 제공을 위해 아래와 같은 개인정보를 수집하고 있습니다.<br/>- 필수항목: 이메일, 비밀번호, 본명, 별명, 학교명, 대학원, 전공, 학기</p>
        <p className="font-bold text-gray-800">2. 개인정보의 수집 및 이용목적</p>
        <p>회사는 수집한 개인정보를 다음의 목적을 위해 활용합니다.<br/>- 서비스 제공에 관한 계약 이행 및 맞춤형 일정/과제 관리 서비스 제공<br/>- 회원 관리 (본인확인, 불량회원의 부정 이용 방지 등)</p>
        <p className="font-bold text-gray-800">3. 개인정보의 보유 및 이용기간</p>
        <p>원칙적으로, 개인정보 수집 및 이용목적이 달성된 후에는 해당 정보를 지체 없이 파기합니다. 단, 관계법령의 규정에 의하여 보존할 필요가 있는 경우 일정 기간 동안 보존합니다.</p>
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900">확인</button>
      </div>
    </div>
  </div>
);

export default PrivacyModal;
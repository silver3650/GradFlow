import React from 'react';
import { X } from 'lucide-react';

const TermsModal = ({ onClose }) => (
  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden flex flex-col max-h-[80vh]">
      <div className="flex justify-between items-center p-5 border-b border-gray-100 bg-slate-50 shrink-0">
        <h3 className="font-bold text-lg text-gray-800">이용약관</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
      </div>
      <div className="p-6 overflow-y-auto flex-1 text-sm text-gray-600 space-y-4 text-left">
        <p className="font-bold text-gray-800">제 1 조 (목적)</p>
        <p>본 약관은 GradFlow(이하 "서비스")가 제공하는 제반 서비스의 이용과 관련하여 회사와 회원과의 권리, 의무 및 책임사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>
        <p className="font-bold text-gray-800">제 2 조 (회원의 의무)</p>
        <p>회원은 서비스 이용 시 본 약관 및 관계 법령을 준수해야 하며, 타인의 정보를 도용하거나 부정한 목적으로 서비스를 이용해서는 안 됩니다.</p>
        <p className="font-bold text-gray-800">제 3 조 (서비스의 제공 등)</p>
        <p>회사는 회원에게 학업 및 연구 일정 관리, 과제 연동 기능을 제공하며, 서비스의 안정적인 운영을 위해 최선을 다합니다.</p>
      </div>
      <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end shrink-0">
        <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-white bg-slate-800 rounded-lg hover:bg-slate-900">확인</button>
      </div>
    </div>
  </div>
);

export default TermsModal;
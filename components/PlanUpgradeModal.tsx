import React from 'react';
import { Check, X, Zap, Loader2 } from 'lucide-react';

interface PlanUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpgrade: () => void;
  isProcessing?: boolean;
}

const PlanUpgradeModal: React.FC<PlanUpgradeModalProps> = ({ isOpen, onClose, onUpgrade, isProcessing = false }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden relative">
        <button 
          onClick={onClose}
          disabled={isProcessing}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
        >
          <X size={24} />
        </button>

        <div className="bg-gradient-to-r from-emerald-500 to-teal-600 p-6 text-white text-center">
          <div className="mx-auto bg-white/20 w-16 h-16 rounded-full flex items-center justify-center mb-4">
            <Zap size={32} className="text-yellow-300" />
          </div>
          <h2 className="text-2xl font-bold mb-1">Upgrade to Pro</h2>
          <p className="text-emerald-100">Unlock unlimited AI analyses</p>
        </div>

        <div className="p-6">
          <div className="space-y-4 mb-8">
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-1 rounded-full text-emerald-600">
                <Check size={16} />
              </div>
              <span className="text-gray-700">Unlimited AI Meal Analysis</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-1 rounded-full text-emerald-600">
                <Check size={16} />
              </div>
              <span className="text-gray-700">Detailed Daily Reports</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-1 rounded-full text-emerald-600">
                <Check size={16} />
              </div>
              <span className="text-gray-700">Priority Processing</span>
            </div>
             <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-1 rounded-full text-emerald-600">
                <Check size={16} />
              </div>
              <span className="text-gray-700">n8n Webhook Integration</span>
            </div>
          </div>

          <button
            onClick={onUpgrade}
            disabled={isProcessing}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-4 rounded-xl transition-all transform hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
          >
            {isProcessing ? (
              <>
                <Loader2 className="animate-spin" size={20} /> Processing...
              </>
            ) : (
              'Upgrade with Stripe'
            )}
          </button>
          
          <p className="text-center text-xs text-gray-400 mt-4">
            Secure payment powered by Stripe.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PlanUpgradeModal;

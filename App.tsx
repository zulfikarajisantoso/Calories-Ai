import React, { useState, useEffect, useRef } from 'react';
import { 
  Camera, 
  Upload, 
  Loader2, 
  Leaf, 
  History, 
  LogOut, 
  Zap, 
  TrendingUp,
  Image as ImageIcon,
  RefreshCw
} from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

import { analyzeMealWithGemini, syncToN8nWebhook, createStripeCheckout, fetchUserPlanStatus } from './services/geminiService';
import { NutritionalData, MealEntry, UserProfile, UserPlan } from './types';
import NutritionChart from './components/NutritionChart';
import PlanUpgradeModal from './components/PlanUpgradeModal';
import NotificationToast, { NotificationState } from './components/NotificationToast';

// Mock initial user template
const INITIAL_USER: UserProfile = {
  id: '', // Will be set dynamically
  name: 'Alex Doe',
  email: 'alex.doe@example.com',
  plan: UserPlan.FREE,
  avatarUrl: 'https://picsum.photos/100/100',
  dailyUsageCount: 0,
  lastUsageDate: new Date().toISOString().split('T')[0],
};

const MAX_FREE_USES = 3;

export default function App() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [inputMethod, setInputMethod] = useState<'text' | 'image'>('image');
  const [inputText, setInputText] = useState('');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [currentResult, setCurrentResult] = useState<MealEntry | null>(null);
  const [history, setHistory] = useState<MealEntry[]>([]);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [isLoginView, setIsLoginView] = useState(true);
  const [notification, setNotification] = useState<NotificationState | null>(null);
  const [isUpgrading, setIsUpgrading] = useState(false);
  const [isSyncingStatus, setIsSyncingStatus] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load state from local storage on mount and check payment status
  useEffect(() => {
    const savedUser = localStorage.getItem('calories_ai_user');
    const savedHistory = localStorage.getItem('calories_ai_history');
    
    // Check for Stripe redirect params
    const urlParams = new URLSearchParams(window.location.search);
    const paymentStatus = urlParams.get('payment');
    
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      
      // Ensure ID exists for legacy data
      if (!parsedUser.id) {
        parsedUser.id = 'usr_restored_' + uuidv4().slice(0, 8);
      }

      // Reset daily limit if it's a new day
      const today = new Date().toISOString().split('T')[0];
      if (parsedUser.lastUsageDate !== today) {
        parsedUser.dailyUsageCount = 0;
        parsedUser.lastUsageDate = today;
      }
      setUser(parsedUser);
      setIsLoginView(false);

      // Verify Account Status (especially if returned from payment)
      if (paymentStatus === 'success') {
        setNotification({ type: 'success', message: 'Payment successful! Verifying plan...' });
        syncAccountStatus(parsedUser.id, parsedUser.email);
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        // Routine check (silent)
        syncAccountStatus(parsedUser.id, parsedUser.email);
      }
    }

    if (savedHistory) {
      setHistory(JSON.parse(savedHistory));
    }
  }, []);

  // Save state effects
  useEffect(() => {
    if (user) localStorage.setItem('calories_ai_user', JSON.stringify(user));
  }, [user]);

  useEffect(() => {
    localStorage.setItem('calories_ai_history', JSON.stringify(history));
  }, [history]);

  const syncAccountStatus = async (userId: string, userEmail: string) => {
    setIsSyncingStatus(true);
    try {
      const actualPlan = await fetchUserPlanStatus(userId, userEmail);
      console.log(`[Status Check] User is ${actualPlan}`);
      
      setUser(prev => {
        if (!prev) return null;
        if (prev.plan !== actualPlan) {
          if (actualPlan === UserPlan.PRO) {
             setNotification({ type: 'success', message: 'Your PRO plan is active!' });
          }
          return { ...prev, plan: actualPlan };
        }
        return prev;
      });
    } catch (error) {
      console.error("Failed to sync status", error);
    } finally {
      setIsSyncingStatus(false);
    }
  };

  const handleLogin = () => {
    // Simulated Google Login
    // We try to keep the ID consistent for this browser so n8n/Firestore gets the same ID for this "user"
    let stableId = localStorage.getItem('calories_ai_stable_id');
    
    if (!stableId) {
      // If no ID exists, create one and save it permanently
      stableId = 'google_uid_' + uuidv4().slice(0, 8);
      localStorage.setItem('calories_ai_stable_id', stableId);
    }
    
    const mockUser = { ...INITIAL_USER, id: stableId };
    setUser(mockUser);
    setIsLoginView(false);
    
    // Sync status on login
    syncAccountStatus(stableId, mockUser.email);
  };

  const handleLogout = () => {
    setUser(null);
    setIsLoginView(true);
    setCurrentResult(null);
    setHistory([]);
    localStorage.removeItem('calories_ai_user');
    localStorage.removeItem('calories_ai_history');
    // We DO NOT remove calories_ai_stable_id so logging back in restores the same "account"
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const checkLimit = (): boolean => {
    if (!user) return false;
    if (user.plan === UserPlan.PRO) return true;
    
    // Check if new day reset needed (double check just in case app stayed open)
    const today = new Date().toISOString().split('T')[0];
    if (user.lastUsageDate !== today) {
      setUser(prev => prev ? ({ ...prev, dailyUsageCount: 0, lastUsageDate: today }) : null);
      return true;
    }

    if (user.dailyUsageCount >= MAX_FREE_USES) {
      setShowUpgradeModal(true);
      return false;
    }
    return true;
  };

  const handleAnalyze = async () => {
    if (!checkLimit()) return;
    if (!user) return;
    
    if (inputMethod === 'text' && !inputText.trim()) return;
    if (inputMethod === 'image' && !selectedImage) return;

    setIsAnalyzing(true);
    setCurrentResult(null);

    try {
      const data: NutritionalData = await analyzeMealWithGemini(inputText, selectedImage || undefined);
      
      const newEntry: MealEntry = {
        id: uuidv4(),
        timestamp: Date.now(),
        textInput: inputText,
        imageUrl: selectedImage || undefined,
        data: data
      };

      setCurrentResult(newEntry);
      setHistory(prev => [newEntry, ...prev]);
      
      // Update Usage
      setUser(prev => {
        if (!prev) return null;
        return {
          ...prev,
          dailyUsageCount: prev.dailyUsageCount + 1
        };
      });

      // Clear Inputs
      setInputText('');
      setSelectedImage(null);

      // Trigger Webhook and handle response
      syncToN8nWebhook(data, user.email, user.id, user.plan)
        .then((response) => {
          if (response.success) {
            setNotification({
              type: 'success',
              message: response.message || 'Analysis saved to cloud.',
              details: typeof response.data === 'object' && !response.data.message 
                ? JSON.stringify(response.data, null, 2) 
                : undefined
            });
          } else {
            console.warn("Webhook returned error state:", response);
             setNotification({
              type: 'info',
              message: 'Analysis complete (Cloud sync pending)',
            });
          }
        })
        .catch((err) => {
          console.error("Webhook call failed", err);
        });

    } catch (error) {
      setNotification({
        type: 'error',
        message: 'Failed to analyze meal. Please try again.'
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setIsUpgrading(true);
    
    try {
      // 1. Request Stripe Checkout URL from n8n
      const checkoutUrl = await createStripeCheckout(user.id, user.email);
      
      // 2. Redirect User
      if (checkoutUrl && checkoutUrl.startsWith('http')) {
        console.log("Redirecting to:", checkoutUrl);
        window.location.replace(checkoutUrl)
      } else {
        throw new Error(`Invalid checkout URL: ${checkoutUrl}`);
      }
    } catch (error) {
      console.error("Upgrade failed:", error);
      setNotification({
        type: 'error',
        message: 'Could not start checkout. Check console.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
      setIsUpgrading(false);
    }
  };

  if (isLoginView) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 to-slate-800 flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl p-8 max-w-md w-full text-center space-y-8">
          <div className="flex justify-center">
            <div className="bg-emerald-100 p-4 rounded-full">
              <Leaf size={48} className="text-emerald-600" />
            </div>
          </div>
          <div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Calories AI</h1>
            <p className="text-gray-500">
              Instantly track calories and macros with the power of Gemini 2.5.
            </p>
          </div>
          
          <div className="space-y-4">
            <button 
              onClick={handleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold py-3 px-4 rounded-xl transition-all shadow-sm"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
              </svg>
              Sign in with Google
            </button>
            <p className="text-xs text-gray-400">
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const remainingFreeUses = user ? Math.max(0, MAX_FREE_USES - user.dailyUsageCount) : 0;
  const isPro = user?.plan === UserPlan.PRO;

  return (
    <div className="min-h-screen bg-slate-50 pb-20 md:pb-0">
      <NotificationToast 
        notification={notification} 
        onClose={() => setNotification(null)} 
      />
      
      <PlanUpgradeModal 
        isOpen={showUpgradeModal} 
        onClose={() => setShowUpgradeModal(false)}
        onUpgrade={handleUpgrade}
        isProcessing={isUpgrading}
      />

      {/* Header */}
      <header className="bg-white sticky top-0 z-30 border-b border-gray-200">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Leaf className="text-emerald-600" />
            <span className="font-bold text-xl text-gray-900 hidden sm:block">Calories AI</span>
          </div>

          <div className="flex items-center gap-4">
            {!isPro && (
               <div className="flex items-center gap-2 bg-slate-100 px-3 py-1.5 rounded-full">
                 <span className="text-xs font-medium text-slate-600">Free Uses: {remainingFreeUses}/{MAX_FREE_USES}</span>
                 <button onClick={() => setShowUpgradeModal(true)} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white text-xs px-2 py-0.5 rounded shadow-sm">
                   UPGRADE
                 </button>
               </div>
            )}
            {isPro && (
              <span className="bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
                <Zap size={12} fill="currentColor" /> PRO
              </span>
            )}
            <button 
              onClick={() => user && syncAccountStatus(user.id, user.email)} 
              disabled={isSyncingStatus}
              className={`text-gray-400 hover:text-emerald-600 transition-colors ${isSyncingStatus ? 'animate-spin text-emerald-600' : ''}`}
              title="Sync Account Status"
            >
              <RefreshCw size={20} />
            </button>
            <button onClick={handleLogout} className="text-gray-400 hover:text-gray-600">
              <LogOut size={20} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto p-4 space-y-6">
        
        {/* Input Section */}
        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="flex border-b border-gray-100">
            <button 
              className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${inputMethod === 'image' ? 'text-emerald-600 bg-emerald-50/50 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setInputMethod('image')}
            >
              <Camera size={18} /> Photo
            </button>
            <button 
              className={`flex-1 py-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${inputMethod === 'text' ? 'text-emerald-600 bg-emerald-50/50 border-b-2 border-emerald-500' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setInputMethod('text')}
            >
              <TrendingUp size={18} /> Text
            </button>
          </div>

          <div className="p-6">
            {inputMethod === 'text' ? (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g., Grilled chicken breast with roasted vegetables and quinoa"
                className="w-full h-32 p-4 rounded-xl border border-gray-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none resize-none text-gray-700 bg-slate-50"
              />
            ) : (
              <div 
                className={`border-2 border-dashed rounded-xl h-48 flex flex-col items-center justify-center cursor-pointer transition-colors ${selectedImage ? 'border-emerald-500 bg-emerald-50/30' : 'border-gray-200 hover:border-emerald-400 hover:bg-slate-50'}`}
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                
                {selectedImage ? (
                  <div className="relative w-full h-full p-2">
                    <img src={selectedImage} alt="Selected" className="w-full h-full object-contain rounded-lg" />
                    <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded-lg m-2">
                      <span className="text-white font-medium flex items-center gap-2">
                         <Upload size={18} /> Change Photo
                      </span>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="bg-emerald-100 p-3 rounded-full mb-3 text-emerald-600">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-gray-600 font-medium">Upload or Take Photo</p>
                    <p className="text-xs text-gray-400 mt-1">Supports JPG, PNG</p>
                  </>
                )}
              </div>
            )}

            <button
              onClick={handleAnalyze}
              disabled={isAnalyzing || (inputMethod === 'text' && !inputText) || (inputMethod === 'image' && !selectedImage)}
              className="mt-6 w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-xl transition-all shadow-lg shadow-emerald-200 flex items-center justify-center gap-2"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="animate-spin" size={20} /> Analyzing with Gemini...
                </>
              ) : (
                <>
                  <Zap size={20} /> Analyze Meal
                </>
              )}
            </button>
          </div>
        </section>

        {/* Results Section */}
        {currentResult && (
          <section className="animate-fade-in space-y-4">
            <h2 className="text-lg font-bold text-gray-800 px-1">Analysis Result</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Main Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="text-xl font-bold text-gray-900 mb-1">{currentResult.data.foodName}</h3>
                 <p className="text-gray-500 text-sm mb-6 italic">"{currentResult.data.notes}"</p>
                 
                 <div className="flex items-center justify-between mb-2">
                    <span className="text-gray-600">Total Calories</span>
                    <span className="text-3xl font-black text-emerald-600">{currentResult.data.calories}</span>
                 </div>
                 <div className="w-full bg-gray-100 rounded-full h-2">
                    <div className="bg-emerald-500 h-2 rounded-full" style={{ width: '100%' }}></div>
                 </div>
              </div>

              {/* Chart Card */}
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center justify-center">
                <NutritionChart data={currentResult.data} />
              </div>
            </div>
            
            {/* Macro Grid */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                <p className="text-blue-600 text-xs font-bold uppercase tracking-wide">Protein</p>
                <p className="text-2xl font-bold text-gray-900">{currentResult.data.protein}g</p>
              </div>
              <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                <p className="text-green-600 text-xs font-bold uppercase tracking-wide">Carbs</p>
                <p className="text-2xl font-bold text-gray-900">{currentResult.data.carbs}g</p>
              </div>
              <div className="bg-orange-50 p-4 rounded-2xl border border-orange-100 text-center">
                <p className="text-orange-600 text-xs font-bold uppercase tracking-wide">Fat</p>
                <p className="text-2xl font-bold text-gray-900">{currentResult.data.fat}g</p>
              </div>
            </div>
          </section>
        )}

        {/* History Section */}
        {history.length > 0 && (
          <section className="space-y-4 pt-6">
            <div className="flex items-center gap-2 text-gray-800 px-1">
              <History size={20} />
              <h2 className="text-lg font-bold">Recent Meals</h2>
            </div>
            
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-4 transition-transform hover:scale-[1.01]">
                  <div className="w-16 h-16 bg-gray-100 rounded-lg overflow-hidden flex-shrink-0">
                    {entry.imageUrl ? (
                      <img src={entry.imageUrl} alt={entry.data.foodName} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-400">
                        <TrendingUp size={24} />
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900">{entry.data.foodName}</h4>
                    <p className="text-xs text-gray-500">{new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                  <div className="text-right">
                    <span className="block font-bold text-emerald-600">{entry.data.calories} kcal</span>
                    <span className="text-xs text-gray-400">
                      P:{entry.data.protein} C:{entry.data.carbs} F:{entry.data.fat}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useNavigate } from 'react-router-dom';
import { createPageUrl } from '../utils';
import { motion } from 'framer-motion';
import { 
  Flag, 
  Target, 
  Zap, 
  Trophy, 
  Check, 
  ArrowRight,
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

const tours = [
  { id: 'PGA', name: 'PGA Tour', description: 'Premier US tour' },
  { id: 'DPWT', name: 'DP World Tour', description: 'European tour' },
  { id: 'LPGA', name: 'LPGA Tour', description: "Women's premier tour" },
  { id: 'LIV', name: 'LIV Golf', description: 'Team-based format' },
  { id: 'KFT', name: 'Korn Ferry Tour', description: 'Developmental tour' }
];

const riskOptions = [
  { id: 'conservative', label: 'Conservative', description: 'Focus on Par Bets (5/1 and under)' },
  { id: 'balanced', label: 'Balanced', description: 'Mix of all tiers' },
  { id: 'aggressive', label: 'Aggressive', description: 'Focus on Eagle Bets (11/1+)' }
];

export default function Join() {
  const [step, setStep] = useState(1);
  const [selectedTours, setSelectedTours] = useState(['PGA', 'DPWT']);
  const [riskAppetite, setRiskAppetite] = useState('balanced');
  const [gamblingAck, setGamblingAck] = useState(false);
  const [user, setUser] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const checkUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
        if (userData.onboarding_completed) {
          navigate(createPageUrl('Home'));
        }
      } catch (e) {}
    };
    checkUser();
  }, [navigate]);

  const handleTourToggle = (tourId) => {
    setSelectedTours(prev => 
      prev.includes(tourId) 
        ? prev.filter(t => t !== tourId)
        : [...prev, tourId]
    );
  };

  const handleComplete = async () => {
    if (!user) {
      api.auth.redirectToLogin();
      return;
    }

    const updatedUser = {
      ...user,
      favorite_tours: selectedTours,
      risk_appetite: riskAppetite,
      responsible_gambling_acknowledged: gamblingAck,
      onboarding_completed: true
    }
    localStorage.setItem('betcaddies_auth', JSON.stringify({
      isLoggedIn: true,
      user: updatedUser
    }))
    setUser(updatedUser)

    navigate(createPageUrl('Home'));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-xl w-full"
      >
        {/* Logo */}
        <div className="text-center mb-10">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center mx-auto mb-4">
            <Flag className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Welcome to Bet Caddies</h1>
          <p className="text-slate-400 mt-2">Your premium golf betting companion</p>
        </div>

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-10">
          {[1, 2, 3].map(s => (
            <div
              key={s}
              className={`w-3 h-3 rounded-full transition-all ${
                s === step 
                  ? 'w-8 bg-emerald-400' 
                  : s < step 
                  ? 'bg-emerald-400' 
                  : 'bg-slate-700'
              }`}
            />
          ))}
        </div>

        {/* Step 1: Tour Preferences */}
        {step === 1 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-xl font-bold text-white mb-2">Select Your Tours</h2>
            <p className="text-slate-400 mb-6">Choose which tours you want to follow</p>

            <div className="space-y-3 mb-8">
              {tours.map(tour => (
                <button
                  key={tour.id}
                  onClick={() => handleTourToggle(tour.id)}
                  className={`w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between ${
                    selectedTours.includes(tour.id)
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">{tour.name}</div>
                    <div className="text-sm text-slate-400">{tour.description}</div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    selectedTours.includes(tour.id)
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-600'
                  }`}>
                    {selectedTours.includes(tour.id) && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <Button
              onClick={() => setStep(2)}
              disabled={selectedTours.length === 0}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Continue
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </motion.div>
        )}

        {/* Step 2: Risk Profile */}
        {step === 2 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-xl font-bold text-white mb-2">Your Risk Profile</h2>
            <p className="text-slate-400 mb-6">This helps us highlight relevant picks</p>

            <div className="space-y-3 mb-8">
              {riskOptions.map(option => (
                <button
                  key={option.id}
                  onClick={() => setRiskAppetite(option.id)}
                  className={`w-full p-4 rounded-xl border transition-all text-left flex items-center justify-between ${
                    riskAppetite === option.id
                      ? 'bg-emerald-500/10 border-emerald-500/50'
                      : 'bg-slate-800/30 border-slate-700/50 hover:border-slate-600'
                  }`}
                >
                  <div>
                    <div className="font-medium text-white">{option.label}</div>
                    <div className="text-sm text-slate-400">{option.description}</div>
                  </div>
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                    riskAppetite === option.id
                      ? 'bg-emerald-500 border-emerald-500'
                      : 'border-slate-600'
                  }`}>
                    {riskAppetite === option.id && (
                      <Check className="w-4 h-4 text-white" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(1)}
                className="flex-1 border-slate-600"
              >
                Back
              </Button>
              <Button
                onClick={() => setStep(3)}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                Continue
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}

        {/* Step 3: Responsible Gambling */}
        {step === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
          >
            <h2 className="text-xl font-bold text-white mb-2">Responsible Gambling</h2>
            <p className="text-slate-400 mb-6">Please read and acknowledge</p>

            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-5 mb-6">
              <div className="flex items-start gap-3 mb-4">
                <Shield className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <div className="font-medium text-white mb-2">Our Commitment</div>
                  <ul className="text-sm text-slate-400 space-y-2">
                    <li>• We provide analysis and information, not guaranteed tips</li>
                    <li>• Only bet what you can afford to lose</li>
                    <li>• Set limits and stick to them</li>
                    <li>• If gambling stops being fun, seek help</li>
                  </ul>
                </div>
              </div>

              <div className="border-t border-slate-700/50 pt-4">
                <p className="text-sm text-slate-400 mb-3">
                  For support, visit{' '}
                  <a href="https://www.begambleaware.org" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                    BeGambleAware.org
                  </a>
                  {' '}or call the National Gambling Helpline.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 mb-8">
              <Checkbox
                id="ack"
                checked={gamblingAck}
                onCheckedChange={setGamblingAck}
                className="mt-0.5"
              />
              <label htmlFor="ack" className="text-sm text-slate-300 cursor-pointer">
                I confirm I am 18+ (or legal gambling age in my jurisdiction) and understand that betting carries risk. I commit to gambling responsibly.
              </label>
            </div>

            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => setStep(2)}
                className="flex-1 border-slate-600"
              >
                Back
              </Button>
              <Button
                onClick={handleComplete}
                disabled={!gamblingAck}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white"
              >
                {user ? 'Complete Setup' : 'Sign In & Complete'}
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
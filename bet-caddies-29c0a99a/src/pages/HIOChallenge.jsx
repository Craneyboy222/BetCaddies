import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Trophy, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HIOChallenge() {
  const [user, setUser] = useState(null);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const queryClient = useQueryClient();

  useEffect(() => {
    const loadUser = async () => {
      try {
        const userData = await api.auth.me();
        setUser(userData);
      } catch (e) {
        // Not logged in
      }
    };
    loadUser();
  }, []);

  // Fetch active challenge
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['activeHIOChallenge'],
    queryFn: () => base44.entities.HIOChallenge.filter({ status: 'active' }, '-created_date', 1)
  });

  const activeChallenge = challenges[0];

  // Fetch user's entry for this challenge
  const { data: userEntry } = useQuery({
    queryKey: ['myHIOEntry', activeChallenge?.id, user?.email],
    queryFn: () => base44.entities.HIOEntry.filter({
      challenge_id: activeChallenge.id,
      user_email: user.email
    }),
    enabled: !!activeChallenge && !!user?.email
  });

  const hasSubmitted = userEntry && userEntry.length > 0;
  const myEntry = hasSubmitted ? userEntry[0] : null;

  // Submit entry mutation
  const submitMutation = useMutation({
    mutationFn: async (answers) => {
      if (!user) {
        api.auth.redirectToLogin();
        return;
      }

      return base44.entities.HIOEntry.create({
        challenge_id: activeChallenge.id,
        user_email: user.email,
        answers: answers,
        submitted_at: new Date().toISOString()
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myHIOEntry'] });
      queryClient.invalidateQueries({ queryKey: ['activeHIOChallenge'] });
    }
  });

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [questionIndex]: answer
    });
  };

  const handleSubmit = () => {
    const answers = [];
    for (let i = 0; i < 10; i++) {
      answers.push(selectedAnswers[i] || '');
    }

    if (answers.some(a => !a)) {
      alert('Please answer all 10 questions before submitting.');
      return;
    }

    submitMutation.mutate(answers);
  };

  if (isLoading) return <LoadingSpinner text="Loading challenge..." />;

  if (!activeChallenge) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
          <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">No Active Challenge</h2>
          <p className="text-slate-400">
            Check back Monday for the new weekly challenge!
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 mb-4">
          <Trophy className="w-8 h-8 text-amber-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">Hole In One Challenge</h1>
        <p className="text-xl text-slate-400">Answer all 10 questions correctly to win!</p>
      </motion.div>

      {/* Challenge Info */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="text-sm text-slate-400 mb-1">This Week's Prize</div>
            <div className="text-2xl font-bold text-amber-400">
              {activeChallenge.prize_description || '£100 Amazon Voucher'}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-slate-400 mb-1">Entries</div>
            <div className="text-2xl font-bold text-white">{activeChallenge.total_entries || 0}</div>
          </div>
        </div>

        {activeChallenge.tournament_names && activeChallenge.tournament_names.length > 0 && (
          <div className="pt-4 border-t border-slate-700/50">
            <div className="text-sm text-slate-400 mb-2">Featured Tournaments</div>
            <div className="flex gap-2 flex-wrap">
              {activeChallenge.tournament_names.map((name, idx) => (
                <Badge key={idx} variant="outline" className="bg-slate-700/50 text-slate-300">
                  {name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Already Submitted */}
      {hasSubmitted && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-8"
        >
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-emerald-400" />
            <div>
              <div className="font-semibold text-white">Entry Submitted!</div>
              <div className="text-sm text-slate-400">
                You've entered this week's challenge. Check back after the tournaments end to see results.
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Questions */}
      {!hasSubmitted && activeChallenge.questions && activeChallenge.questions.length === 10 ? (
        <div className="space-y-4 mb-8">
          {activeChallenge.questions.map((q, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
              className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6"
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">
                  {idx + 1}
                </div>
                <div className="flex-1">
                  <div className="text-lg font-medium text-white mb-4">
                    {q.question_text}
                  </div>
                  <div className="grid gap-3">
                    {q.options.map((option, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => handleAnswerSelect(idx, option)}
                        className={`p-4 rounded-lg border-2 transition-all text-left ${
                          selectedAnswers[idx] === option
                            ? 'border-emerald-500 bg-emerald-500/20 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      ) : !hasSubmitted && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center mb-8">
          <Clock className="w-12 h-12 text-slate-400 mx-auto mb-3" />
          <p className="text-slate-400">Questions are being generated. Check back soon!</p>
        </div>
      )}

      {/* Submit Button */}
      {!hasSubmitted && activeChallenge.questions?.length === 10 && (
        <Button
          onClick={handleSubmit}
          disabled={submitMutation.isPending || Object.keys(selectedAnswers).length !== 10}
          className="w-full bg-emerald-500 hover:bg-emerald-600 text-lg py-6"
        >
          {submitMutation.isPending ? 'Submitting...' : 'Submit My Entry'}
        </Button>
      )}

      {/* Rules */}
      <div className="mt-8 bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
        <h3 className="text-lg font-bold text-white mb-3">How It Works</h3>
        <ul className="space-y-2 text-slate-300 text-sm">
          <li>• Answer all 10 questions about this week's golf tournaments</li>
          <li>• Submit your entry before the tournaments end</li>
          <li>• Get all 10 correct to win the prize</li>
          <li>• Only ONE entry per person per week</li>
          <li>• Winners announced after results are finalized</li>
        </ul>
      </div>
    </div>
  );
}
import React, { useState, useEffect } from 'react';
import { api } from '@/api/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  Clock,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  ChevronLeft,
  Lock,
  Gift,
  Users,
  Target,
  Medal,
  History
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import SEOHead from '@/components/SEOHead';

export default function HIOChallenge() {
  const [user, setUser] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [showLoginPrompt, setShowLoginPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState('challenge'); // 'challenge' | 'leaderboard' | 'history'
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
  const { data: challengeResponse, isLoading } = useQuery({
    queryKey: ['activeHIOChallenge'],
    queryFn: () => api.hio.challenge.active(),
    retry: false
  });

  const activeChallenge = challengeResponse?.data || challengeResponse;

  // Fetch user's entry for this challenge
  const { data: myEntry } = useQuery({
    queryKey: ['myHIOEntry', activeChallenge?.id, user?.email],
    queryFn: () => api.hio.entry.me(activeChallenge.id),
    enabled: !!activeChallenge?.id && !!user?.email,
    retry: false
  });

  // Fetch page content from SiteContent
  const { data: pageContent } = useQuery({
    queryKey: ['hioPageContent'],
    queryFn: async () => {
      try {
        const resp = await api.client.get('/api/site-content/hio_page');
        return resp?.data?.json || resp?.json || {};
      } catch {
        return {};
      }
    },
    retry: false
  });

  // Fetch leaderboard
  const { data: leaderboard = [] } = useQuery({
    queryKey: ['hioLeaderboard'],
    queryFn: () => api.hio.leaderboard(10),
    retry: false
  });

  // Fetch my history
  const { data: myHistory = [] } = useQuery({
    queryKey: ['hioMyHistory'],
    queryFn: () => api.hio.myHistory(),
    enabled: !!user,
    retry: false
  });

  const hasSubmitted = !!myEntry;

  // Submit entry mutation
  const submitMutation = useMutation({
    mutationFn: async (answers) => {
      return api.hio.entry.submit({
        challengeId: activeChallenge.id,
        answers
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['myHIOEntry'] });
      queryClient.invalidateQueries({ queryKey: ['activeHIOChallenge'] });
      setIsModalOpen(false);
      setCurrentQuestionIndex(0);
      setSelectedAnswers({});
    }
  });

  const handleEnterClick = () => {
    if (!user) {
      setShowLoginPrompt(true);
      return;
    }
    if (hasSubmitted) return;
    setIsModalOpen(true);
    setCurrentQuestionIndex(0);
    setSelectedAnswers({});
  };

  const handleAnswerSelect = (answer) => {
    setSelectedAnswers({
      ...selectedAnswers,
      [currentQuestionIndex]: answer
    });
  };

  const handleNext = () => {
    if (currentQuestionIndex < 9) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
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

  const answeredCount = Object.keys(selectedAnswers).length;
  const canSubmit = answeredCount === 10;
  const questions = activeChallenge?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];

  // Dynamic content with fallbacks
  const heroTitle = pageContent?.hero_title || 'Hole In One Challenge';
  const heroTagline = pageContent?.hero_tagline || 'Answer 10 questions correctly to win!';
  const noActiveChallengeText = pageContent?.no_challenge_text || 'Check back Tuesday for the new weekly challenge!';
  const step1Title = pageContent?.step1_title || 'Answer Questions';
  const step1Desc = pageContent?.step1_desc || '10 golf questions about this week\'s tournaments';
  const step2Title = pageContent?.step2_title || 'Submit Entry';
  const step2Desc = pageContent?.step2_desc || 'One entry per person per week';
  const step3Title = pageContent?.step3_title || 'Win Prizes';
  const step3Desc = pageContent?.step3_desc || 'Get all 10 correct to claim the prize!';

  if (isLoading) return <LoadingSpinner text="Loading challenge..." />;

  return (
    <>
      <SEOHead title="Hole-in-One Challenge" description="Enter the BetCaddies Hole-in-One Challenge for a chance to win prizes." path="/HIOChallenge" />
      <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Hero Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-amber-500/30 to-amber-600/20 border border-amber-500/30 mb-4">
          <Trophy className="w-10 h-10 text-amber-400" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">{heroTitle}</h1>
        <p className="text-xl text-slate-400">{heroTagline}</p>
      </motion.div>

      {/* Tab Navigation */}
      <div className="flex gap-2 mb-6 justify-center">
        <button
          onClick={() => setActiveTab('challenge')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'challenge'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Target className="w-4 h-4 inline mr-2" />
          This Week
        </button>
        <button
          onClick={() => setActiveTab('leaderboard')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            activeTab === 'leaderboard'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
          }`}
        >
          <Medal className="w-4 h-4 inline mr-2" />
          Leaderboard
        </button>
        {user && (
          <button
            onClick={() => setActiveTab('history')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'history'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
            }`}
          >
            <History className="w-4 h-4 inline mr-2" />
            My History
          </button>
        )}
      </div>

      {/* Leaderboard Tab */}
      {activeTab === 'leaderboard' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Medal className="w-5 h-5 text-amber-400" />
                Top Players
              </h2>
              <p className="text-sm text-slate-400 mt-1">Points: 10 (perfect), 5 (8-9 correct), 2 (5-7), 1 (participation)</p>
            </div>
            {leaderboard.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                No entries yet. Be the first to play!
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-700/50">
                    <th className="text-left p-3 text-slate-400 font-medium w-12">#</th>
                    <th className="text-left p-3 text-slate-400 font-medium">Player</th>
                    <th className="text-right p-3 text-slate-400 font-medium">Points</th>
                    <th className="text-right p-3 text-slate-400 font-medium hidden sm:table-cell">Played</th>
                    <th className="text-right p-3 text-slate-400 font-medium hidden sm:table-cell">Perfect</th>
                  </tr>
                </thead>
                <tbody>
                  {leaderboard.map((entry) => (
                    <tr key={entry.rank} className="border-b border-slate-700/30 last:border-0">
                      <td className="p-3">
                        {entry.rank <= 3 ? (
                          <span className={`font-bold ${
                            entry.rank === 1 ? 'text-amber-400' :
                            entry.rank === 2 ? 'text-slate-300' :
                            'text-amber-700'
                          }`}>
                            {entry.rank === 1 ? '\uD83E\uDD47' : entry.rank === 2 ? '\uD83E\uDD48' : '\uD83E\uDD49'}
                          </span>
                        ) : (
                          <span className="text-slate-500">{entry.rank}</span>
                        )}
                      </td>
                      <td className="p-3 text-white font-medium">{entry.display_name}</td>
                      <td className="p-3 text-right text-emerald-400 font-bold">{entry.total_points}</td>
                      <td className="p-3 text-right text-slate-400 hidden sm:table-cell">{entry.challenges_entered}</td>
                      <td className="p-3 text-right text-amber-400 hidden sm:table-cell">{entry.perfect_scores}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </motion.div>
      )}

      {/* History Tab */}
      {activeTab === 'history' && user && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <div className="p-4 border-b border-slate-700/50">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <History className="w-5 h-5 text-blue-400" />
                My Challenge History
              </h2>
            </div>
            {myHistory.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                You haven't entered any challenges yet.
              </div>
            ) : (
              <div className="divide-y divide-slate-700/30">
                {myHistory.map((entry) => (
                  <div key={entry.id} className="p-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-white font-medium">
                        {Array.isArray(entry.tournament_names) && entry.tournament_names.length > 0
                          ? entry.tournament_names.join(', ')
                          : 'Challenge'}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {new Date(entry.challenge_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      {entry.score != null ? (
                        <div className={`text-lg font-bold ${entry.is_perfect ? 'text-amber-400' : 'text-white'}`}>
                          {entry.score}/10
                          {entry.is_perfect && ' \u2B50'}
                        </div>
                      ) : (
                        <Badge className="bg-slate-700/50 text-slate-400">
                          {entry.challenge_status === 'active' ? 'Awaiting Results' : 'Pending'}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </motion.div>
      )}

      {/* Challenge Tab */}
      {activeTab === 'challenge' && (
        <>
          {/* No Active Challenge */}
          {!activeChallenge && (
            <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-12 text-center">
              <AlertCircle className="w-16 h-16 text-slate-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-2">No Active Challenge</h2>
              <p className="text-slate-400">{noActiveChallengeText}</p>
            </div>
          )}

          {/* Active Challenge Card */}
          {activeChallenge && (
            <>
              {/* Prize Card */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gradient-to-br from-amber-500/10 to-amber-600/5 rounded-xl border border-amber-500/30 p-8 mb-6"
              >
                <div className="flex items-center gap-4 mb-6">
                  <Gift className="w-12 h-12 text-amber-400" />
                  <div>
                    <div className="text-sm text-amber-400/80 uppercase tracking-wide font-semibold">This Week's Prize</div>
                    <div className="text-3xl font-bold text-white">
                      {activeChallenge.prize_description || '£100 Amazon Voucher'}
                    </div>
                  </div>
                </div>

                {/* Tournament Info */}
                {activeChallenge.tournament_names && activeChallenge.tournament_names.length > 0 && (
                  <div className="mb-6">
                    <div className="text-sm text-slate-400 mb-2">Featured Tournaments</div>
                    <div className="flex gap-2 flex-wrap">
                      {activeChallenge.tournament_names.map((name, idx) => (
                        <Badge key={idx} className="bg-slate-700/50 text-slate-200 border border-slate-600">
                          {name}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <Users className="w-6 h-6 text-slate-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">{activeChallenge.total_entries || 0}</div>
                    <div className="text-sm text-slate-400">Entries</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-4 text-center">
                    <Target className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
                    <div className="text-2xl font-bold text-white">10</div>
                    <div className="text-sm text-slate-400">Questions</div>
                  </div>
                </div>
              </motion.div>

              {/* Entry Status / Enter Button */}
              {hasSubmitted ? (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-6 mb-6"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-8 h-8 text-emerald-400" />
                    <div>
                      <div className="font-bold text-white text-lg">Entry Submitted!</div>
                      <div className="text-sm text-slate-400">
                        You've entered this week's challenge. Check back after the tournaments end to see results.
                      </div>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-6"
                >
                  <Button
                    onClick={handleEnterClick}
                    disabled={!activeChallenge?.questions?.length}
                    className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white text-xl py-8 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-50"
                  >
                    <Trophy className="w-6 h-6 mr-3" />
                    ENTER FREE
                  </Button>
                  {!activeChallenge?.questions?.length && (
                    <p className="text-center text-slate-400 text-sm mt-2">
                      <Clock className="w-4 h-4 inline mr-1" />
                      Questions are being generated. Check back soon!
                    </p>
                  )}
                </motion.div>
              )}

              {/* How It Works */}
              <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6 mb-6">
                <h3 className="text-lg font-bold text-white mb-4">How It Works</h3>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">1</div>
                    <div>
                      <div className="font-medium text-white">{step1Title}</div>
                      <div className="text-sm text-slate-400">{step1Desc}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">2</div>
                    <div>
                      <div className="font-medium text-white">{step2Title}</div>
                      <div className="text-sm text-slate-400">{step2Desc}</div>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold">3</div>
                    <div>
                      <div className="font-medium text-white">{step3Title}</div>
                      <div className="text-sm text-slate-400">{step3Desc}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Mini Leaderboard */}
              {leaderboard.length > 0 && (
                <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                      <Medal className="w-5 h-5 text-amber-400" />
                      Top Players
                    </h3>
                    <button
                      onClick={() => setActiveTab('leaderboard')}
                      className="text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
                    >
                      View Full Leaderboard
                    </button>
                  </div>
                  <div className="space-y-2">
                    {leaderboard.slice(0, 5).map((entry) => (
                      <div key={entry.rank} className="flex items-center justify-between py-2">
                        <div className="flex items-center gap-3">
                          <span className={`w-6 text-center font-bold ${
                            entry.rank === 1 ? 'text-amber-400' :
                            entry.rank === 2 ? 'text-slate-300' :
                            entry.rank === 3 ? 'text-amber-700' :
                            'text-slate-500'
                          }`}>
                            {entry.rank}
                          </span>
                          <span className="text-white text-sm">{entry.display_name}</span>
                        </div>
                        <span className="text-emerald-400 font-bold text-sm">{entry.total_points} pts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* Login Prompt Modal */}
      <Dialog open={showLoginPrompt} onOpenChange={setShowLoginPrompt}>
        <DialogContent className="bg-slate-900 border-slate-700">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Lock className="w-5 h-5 text-amber-400" />
              Sign In Required
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              You need to sign in or create a free account to enter the HIO Challenge.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              onClick={() => {
                setShowLoginPrompt(false);
                api.auth.redirectToLogin();
              }}
              className="bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              Sign In / Create Account
            </Button>
            <Button
              variant="ghost"
              onClick={() => setShowLoginPrompt(false)}
              className="text-slate-400"
            >
              Cancel
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Questions Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 max-w-2xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center justify-between">
              <span>HIO Challenge</span>
              <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/50">
                {answeredCount}/10 Answered
              </Badge>
            </DialogTitle>
          </DialogHeader>

          {currentQuestion && (
            <div className="py-4">
              {/* Progress Bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm text-slate-400 mb-2">
                  <span>Question {currentQuestionIndex + 1} of 10</span>
                  <span>{Math.round((currentQuestionIndex + 1) / 10 * 100)}%</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                    initial={{ width: 0 }}
                    animate={{ width: `${(currentQuestionIndex + 1) / 10 * 100}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              </div>

              {/* Question */}
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentQuestionIndex}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                  className="mb-6"
                >
                  <div className="text-xl font-medium text-white mb-6">
                    {currentQuestion.question_text}
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    {(currentQuestion.options || []).map((option, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => handleAnswerSelect(option)}
                        className={`w-full p-4 rounded-lg border-2 transition-all text-left ${
                          selectedAnswers[currentQuestionIndex] === option
                            ? 'border-emerald-500 bg-emerald-500/20 text-white'
                            : 'border-slate-700 bg-slate-800/50 text-slate-300 hover:border-slate-600 hover:bg-slate-800'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                            selectedAnswers[currentQuestionIndex] === option
                              ? 'border-emerald-500 bg-emerald-500'
                              : 'border-slate-600'
                          }`}>
                            {selectedAnswers[currentQuestionIndex] === option && (
                              <CheckCircle className="w-4 h-4 text-white" />
                            )}
                          </div>
                          <span>{option}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation */}
              <div className="flex justify-between items-center pt-4 border-t border-slate-700">
                <Button
                  variant="ghost"
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="text-slate-400"
                >
                  <ChevronLeft className="w-5 h-5 mr-1" />
                  Previous
                </Button>

                {/* Question dots */}
                <div className="flex gap-1">
                  {Array.from({ length: 10 }).map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setCurrentQuestionIndex(idx)}
                      className={`w-3 h-3 rounded-full transition-all ${
                        idx === currentQuestionIndex
                          ? 'bg-emerald-500 scale-125'
                          : selectedAnswers[idx]
                            ? 'bg-emerald-500/50'
                            : 'bg-slate-600'
                      }`}
                    />
                  ))}
                </div>

                {currentQuestionIndex === 9 ? (
                  <Button
                    onClick={handleSubmit}
                    disabled={!canSubmit || submitMutation.isPending}
                    className="bg-emerald-500 hover:bg-emerald-600"
                  >
                    {submitMutation.isPending ? 'Submitting...' : 'Submit Entry'}
                  </Button>
                ) : (
                  <Button
                    onClick={handleNext}
                    className="bg-slate-700 hover:bg-slate-600"
                  >
                    Next
                    <ChevronRight className="w-5 h-5 ml-1" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
}

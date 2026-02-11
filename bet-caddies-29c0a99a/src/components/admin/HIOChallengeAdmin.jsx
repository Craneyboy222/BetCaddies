import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/api/client';
import { motion } from 'framer-motion';
import {
  Trophy,
  RefreshCw,
  Edit2,
  Save,
  X,
  CheckCircle,
  Users,
  TrendingUp,
  Plus,
  Trash2,
  Gift
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HIOChallengeAdmin() {
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingPrize, setEditingPrize] = useState(false);
  const [prizeText, setPrizeText] = useState('');
  const queryClient = useQueryClient();

  // Fetch challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['allHIOChallenges'],
    queryFn: () => api.entities.HIOChallenge.list(),
    retry: false
  });

  const activeChallenge = challenges.find(c => c.status === 'active');

  // Fetch entries for active challenge
  const { data: entries = [] } = useQuery({
    queryKey: ['hioEntries', activeChallenge?.id],
    queryFn: () => api.entities.HIOEntry.listByChallenge(activeChallenge.id),
    enabled: !!activeChallenge
  });

  // Auto-generate weekly challenge from current events
  const generateWeeklyMutation = useMutation({
    mutationFn: async () => {
      return api.entities.HIOChallenge.generateWeekly('£100 Amazon Voucher')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Regenerate single question using server-side generator (real event data)
  const regenerateQuestionMutation = useMutation({
    mutationFn: async (index) => {
      return api.entities.HIOChallenge.regenerateQuestion(activeChallenge.id, index);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Regenerate ALL questions via server-side generator
  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      // Generate a new weekly challenge to get fresh questions, then apply them
      const fresh = await api.entities.HIOChallenge.generateWeekly(
        activeChallenge.prizeDescription || activeChallenge.prize_description || '£100 Amazon Voucher'
      );
      return fresh;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Update question
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ index, question }) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions[index] = question;
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingQuestion(null);
    }
  });

  // Add blank question
  const addQuestionMutation = useMutation({
    mutationFn: async () => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions.push({
        question_text: 'New question — edit or regenerate',
        options: ['Option A', 'Option B'],
        correct_answer: 'Option A'
      });
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Delete question
  const deleteQuestionMutation = useMutation({
    mutationFn: async (index) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions.splice(index, 1);
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Set correct answer
  const setCorrectAnswerMutation = useMutation({
    mutationFn: async ({ index, answer }) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions[index].correct_answer = answer;
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Update prize description
  const updatePrizeMutation = useMutation({
    mutationFn: async (prize) => {
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        prize_description: prize
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingPrize(false);
    }
  });

  // Calculate scores
  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      return api.entities.HIOChallenge.calculateScores(activeChallenge.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      queryClient.invalidateQueries({ queryKey: ['hioEntries'] });
    }
  });

  if (isLoading) return <LoadingSpinner />;

  if (!activeChallenge) {
    return (
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-8 text-center">
        <Trophy className="w-12 h-12 text-slate-400 mx-auto mb-3" />
        <p className="text-slate-400 mb-4">No active challenge.</p>
        <Button
          onClick={() => generateWeeklyMutation.mutate()}
          disabled={generateWeeklyMutation.isPending}
          className="bg-emerald-500 hover:bg-emerald-600"
        >
          {generateWeeklyMutation.isPending ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Generate Weekly Challenge
            </>
          )}
        </Button>
      </div>
    );
  }

  const prize = activeChallenge.prizeDescription || activeChallenge.prize_description || '';
  const tournaments = activeChallenge.tournamentNames || activeChallenge.tournament_names || [];

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-blue-400" />
            <span className="text-sm text-slate-400">Total Entries</span>
          </div>
          <div className="text-2xl font-bold text-white">{entries.length}</div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-amber-400" />
            <span className="text-sm text-slate-400">Perfect Scores</span>
          </div>
          <div className="text-2xl font-bold text-amber-400">
            {activeChallenge.perfect_scores || activeChallenge.perfectScores || 0}
          </div>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-sm text-slate-400">Status</span>
          </div>
          <Badge className={
            activeChallenge.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' :
            activeChallenge.status === 'settled' ? 'bg-blue-500/20 text-blue-400' :
            'bg-slate-500/20 text-slate-400'
          }>
            {activeChallenge.status}
          </Badge>
        </div>

        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-slate-400">Questions</span>
          </div>
          <div className="text-2xl font-bold text-white">{(activeChallenge.questions || []).length}</div>
        </div>
      </div>

      {/* Prize & Tournament Info */}
      <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-300">Prize</h3>
          {!editingPrize && (
            <Button variant="ghost" size="sm" onClick={() => { setEditingPrize(true); setPrizeText(prize); }} className="text-slate-400 hover:text-white">
              <Edit2 className="w-4 h-4" />
            </Button>
          )}
        </div>
        {editingPrize ? (
          <div className="flex gap-2">
            <Input
              value={prizeText}
              onChange={(e) => setPrizeText(e.target.value)}
              className="bg-slate-800 border-slate-700 flex-1"
              placeholder="e.g. £100 Amazon Voucher"
            />
            <Button size="sm" onClick={() => updatePrizeMutation.mutate(prizeText)} disabled={updatePrizeMutation.isPending} className="bg-emerald-500 hover:bg-emerald-600">
              <Save className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => setEditingPrize(false)} className="border-slate-600">
              <X className="w-4 h-4" />
            </Button>
          </div>
        ) : (
          <p className="text-white">{prize || 'No prize set'}</p>
        )}
        {tournaments.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-700/50">
            <span className="text-xs text-slate-500">Tournaments: </span>
            <span className="text-sm text-slate-300">{tournaments.join(', ')}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex gap-3 flex-wrap">
        <Button
          onClick={() => regenerateAllMutation.mutate()}
          disabled={regenerateAllMutation.isPending}
          variant="outline"
          className="border-slate-600"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${regenerateAllMutation.isPending ? 'animate-spin' : ''}`} />
          Regenerate All Questions
        </Button>

        <Button
          onClick={() => addQuestionMutation.mutate()}
          disabled={addQuestionMutation.isPending}
          variant="outline"
          className="border-slate-600"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Question
        </Button>

        {activeChallenge.status === 'active' && (
          <Button
            onClick={() => calculateScoresMutation.mutate()}
            disabled={calculateScoresMutation.isPending}
            className="bg-emerald-500 hover:bg-emerald-600"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Calculate Scores & Close
          </Button>
        )}
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-white">Questions ({(activeChallenge.questions || []).length})</h3>

        {activeChallenge.questions?.map((q, idx) => (
          <div
            key={idx}
            className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-4"
          >
            {editingQuestion === idx ? (
              <EditQuestionForm
                question={q}
                onSave={(updated) => updateQuestionMutation.mutate({ index: idx, question: updated })}
                onCancel={() => setEditingQuestion(null)}
              />
            ) : (
              <div>
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-amber-400 font-bold flex-shrink-0">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="font-medium text-white mb-2">{q.question_text}</div>
                      {q.type && (
                        <Badge className="bg-slate-700/50 text-slate-400 border-slate-600 text-xs mb-2">
                          {q.type.replace(/_/g, ' ')}
                        </Badge>
                      )}
                      <div className="flex gap-2 flex-wrap">
                        {q.options.map((opt, optIdx) => (
                          <Badge
                            key={optIdx}
                            className={
                              q.correct_answer === opt
                                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                                : 'bg-slate-700/50 text-slate-300 border-slate-600'
                            }
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingQuestion(idx)}
                      className="text-slate-400 hover:text-white"
                      title="Edit question"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateQuestionMutation.mutate(idx)}
                      disabled={regenerateQuestionMutation.isPending}
                      className="text-slate-400 hover:text-emerald-400"
                      title="Regenerate from current event data"
                    >
                      <RefreshCw className={`w-4 h-4 ${regenerateQuestionMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm('Delete this question?')) return;
                        deleteQuestionMutation.mutate(idx);
                      }}
                      className="text-slate-400 hover:text-red-400"
                      title="Delete question"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Set Correct Answer */}
                <div className="pt-3 border-t border-slate-700/50">
                  <div className="text-sm text-slate-400 mb-2">Correct Answer:</div>
                  <div className="flex gap-2 flex-wrap">
                    {q.options.map((opt, optIdx) => (
                      <button
                        key={optIdx}
                        onClick={() => setCorrectAnswerMutation.mutate({ index: idx, answer: opt })}
                        className={`px-3 py-1 rounded-lg text-sm transition-all ${
                          q.correct_answer === opt
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
                        }`}
                      >
                        {opt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Entries */}
      {entries.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-white">Entries ({entries.length})</h3>
          <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/50">
                  <th className="text-left p-3 text-slate-400 font-medium">User</th>
                  <th className="text-left p-3 text-slate-400 font-medium">Submitted</th>
                  <th className="text-right p-3 text-slate-400 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-700/30 last:border-0">
                    <td className="p-3 text-white">{entry.user_email || entry.userEmail}</td>
                    <td className="p-3 text-slate-400">{new Date(entry.submitted_at || entry.submittedAt).toLocaleDateString()}</td>
                    <td className="p-3 text-right">
                      {entry.score != null ? (
                        <span className={entry.is_perfect || entry.isPerfect ? 'text-amber-400 font-bold' : 'text-white'}>
                          {entry.score}/{(activeChallenge.questions || []).length}
                          {(entry.is_perfect || entry.isPerfect) && ' \u2B50'}
                        </span>
                      ) : (
                        <span className="text-slate-500">Pending</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function EditQuestionForm({ question, onSave, onCancel }) {
  const [form, setForm] = useState({
    question_text: question.question_text,
    options: [...question.options],
    correct_answer: question.correct_answer
  });

  return (
    <div className="space-y-4">
      <div>
        <label className="text-sm text-slate-400 mb-2 block">Question</label>
        <Textarea
          value={form.question_text}
          onChange={(e) => setForm({ ...form, question_text: e.target.value })}
          className="bg-slate-800 border-slate-700"
        />
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Options</label>
        {form.options.map((opt, idx) => (
          <Input
            key={idx}
            value={opt}
            onChange={(e) => {
              const newOptions = [...form.options];
              newOptions[idx] = e.target.value;
              setForm({ ...form, options: newOptions });
            }}
            className="bg-slate-800 border-slate-700 mb-2"
          />
        ))}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setForm({
              ...form,
              options: [...form.options, `Option ${String.fromCharCode(65 + form.options.length)}`]
            })}
            className="border-slate-600"
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Option
          </Button>
          {form.options.length > 2 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                const newOptions = form.options.slice(0, -1);
                const newCorrect = newOptions.includes(form.correct_answer)
                  ? form.correct_answer
                  : newOptions[0];
                setForm({ ...form, options: newOptions, correct_answer: newCorrect });
              }}
              className="border-slate-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Option
            </Button>
          )}
        </div>
      </div>

      <div>
        <label className="text-sm text-slate-400 mb-2 block">Correct Answer</label>
        <div className="flex gap-2 flex-wrap">
          {form.options.map((opt, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setForm({ ...form, correct_answer: opt })}
              className={`px-3 py-1 rounded-lg text-sm transition-all ${
                form.correct_answer === opt
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-slate-700/50 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={onCancel} className="border-slate-600">
          <X className="w-4 h-4 mr-2" />
          Cancel
        </Button>
        <Button onClick={() => onSave(form)} className="bg-emerald-500 hover:bg-emerald-600">
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );
}

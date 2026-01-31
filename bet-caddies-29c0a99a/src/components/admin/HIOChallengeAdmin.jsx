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
  Trash2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import LoadingSpinner from '@/components/ui/LoadingSpinner';

export default function HIOChallengeAdmin() {
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [editingAnswer, setEditingAnswer] = useState({});
  const queryClient = useQueryClient();

  const createBlankQuestion = () => ({
    question_text: 'New question',
    options: ['Option A', 'Option B', 'Option C', 'Option D'],
    correct_answer: 'Option A'
  })

  const questionPool = [
    {
      question_text: 'Which player is most likely to finish highest this week?',
      options: ['Player A', 'Player B', 'Player C', 'Player D'],
      correct_answer: 'Player A'
    },
    {
      question_text: 'Which golfer will lead the field in birdies?',
      options: ['Player A', 'Player B', 'Player C', 'Player D'],
      correct_answer: 'Player B'
    },
    {
      question_text: 'Who is most likely to win the tournament?',
      options: ['Player A', 'Player B', 'Player C', 'Player D'],
      correct_answer: 'Player C'
    },
    {
      question_text: 'Which golfer will record the lowest round?',
      options: ['Player A', 'Player B', 'Player C', 'Player D'],
      correct_answer: 'Player D'
    }
  ]

  const generateQuestion = () => {
    const base = questionPool[Math.floor(Math.random() * questionPool.length)]
    return {
      question_text: base.question_text,
      options: [...base.options],
      correct_answer: base.correct_answer
    }
  }

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
  })

  // Placeholder (Base44 AI generator removed)
  const regenerateQuestionMutation = useMutation({
    mutationFn: async (index) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions[index] = generateQuestion()
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingQuestion(null);
    }
  })

  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      const count = Math.max(10, (activeChallenge.questions || []).length)
      const regenerated = Array.from({ length: count }, () => generateQuestion())
      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: regenerated
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingQuestion(null);
    }
  })

  // Update question
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ index, question }) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions[index] = question;

      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingQuestion(null);
    }
  });

  // Set correct answer
  const setCorrectAnswerMutation = useMutation({
    mutationFn: async ({ index, answer }) => {
      const updatedQuestions = [...(activeChallenge.questions || [])];
      updatedQuestions[index].correct_answer = answer;

      return api.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingAnswer({});
    }
  });

  // Calculate scores
  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      return api.entities.HIOChallenge.calculateScores(activeChallenge.id)
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

  return (
    <div className="space-y-6">
      {/* Header Stats */}
      <div className="grid grid-cols-3 gap-4">
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
            {activeChallenge.perfect_scores || 0}
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
      </div>

      {/* Actions */}
      <div className="flex gap-3">
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
          onClick={() => {
            const updatedQuestions = [...(activeChallenge.questions || [])]
            updatedQuestions.push(createBlankQuestion())
            updateQuestionMutation.mutate({
              index: updatedQuestions.length - 1,
              question: updatedQuestions[updatedQuestions.length - 1]
            })
          }}
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
        <h3 className="text-lg font-bold text-white">Questions</h3>
        
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
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingQuestion(idx)}
                      className="text-slate-400 hover:text-white"
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => regenerateQuestionMutation.mutate(idx)}
                      disabled={regenerateQuestionMutation.isPending}
                      className="text-slate-400 hover:text-emerald-400"
                    >
                      <RefreshCw className={`w-4 h-4 ${regenerateQuestionMutation.isPending ? 'animate-spin' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        if (!window.confirm('Delete this question?')) return
                        const updatedQuestions = [...(activeChallenge.questions || [])]
                        updatedQuestions.splice(idx, 1)
                        api.entities.HIOChallenge.update(activeChallenge.id, {
                          questions: updatedQuestions
                        }).then(() => queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] }))
                      }}
                      className="text-slate-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Set Correct Answer */}
                <div className="pt-3 border-t border-slate-700/50">
                  <div className="text-sm text-slate-400 mb-2">Correct Answer:</div>
                  <div className="flex gap-2">
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
                const newOptions = form.options.slice(0, -1)
                const newCorrect = newOptions.includes(form.correct_answer)
                  ? form.correct_answer
                  : newOptions[0]
                setForm({ ...form, options: newOptions, correct_answer: newCorrect })
              }}
              className="border-slate-600"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Remove Option
            </Button>
          )}
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
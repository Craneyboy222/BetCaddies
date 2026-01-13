import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { motion } from 'framer-motion';
import {
  Trophy,
  RefreshCw,
  Edit2,
  Save,
  X,
  CheckCircle,
  Users,
  TrendingUp
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

  // Fetch challenges
  const { data: challenges = [], isLoading } = useQuery({
    queryKey: ['allHIOChallenges'],
    queryFn: () => base44.entities.HIOChallenge.list('-created_date', 10)
  });

  const activeChallenge = challenges.find(c => c.status === 'active');

  // Fetch entries for active challenge
  const { data: entries = [] } = useQuery({
    queryKey: ['hioEntries', activeChallenge?.id],
    queryFn: () => base44.entities.HIOEntry.filter({ challenge_id: activeChallenge.id }),
    enabled: !!activeChallenge
  });

  // Regenerate single question
  const regenerateQuestionMutation = useMutation({
    mutationFn: async (questionIndex) => {
      const response = await base44.functions.invoke('generateHIOQuestions', {
        challengeId: activeChallenge.id,
        regenerateIndex: questionIndex
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Regenerate all questions
  const regenerateAllMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateHIOQuestions', {
        challengeId: activeChallenge.id
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
    }
  });

  // Update question
  const updateQuestionMutation = useMutation({
    mutationFn: async ({ index, question }) => {
      const updatedQuestions = [...activeChallenge.questions];
      updatedQuestions[index] = question;
      
      return base44.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingQuestion(null);
    }
  });

  // Set correct answer
  const setCorrectAnswerMutation = useMutation({
    mutationFn: async ({ index, answer }) => {
      const updatedQuestions = [...activeChallenge.questions];
      updatedQuestions[index].correct_answer = answer;
      
      return base44.entities.HIOChallenge.update(activeChallenge.id, {
        questions: updatedQuestions
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allHIOChallenges'] });
      setEditingAnswer({});
    }
  });

  // Calculate scores
  const calculateScoresMutation = useMutation({
    mutationFn: async () => {
      // Score all entries
      for (const entry of entries) {
        let score = 0;
        for (let i = 0; i < activeChallenge.questions.length; i++) {
          const correctAnswer = activeChallenge.questions[i].correct_answer;
          if (correctAnswer && entry.answers[i] === correctAnswer) {
            score++;
          }
        }

        const isPerfect = score === 10;

        await base44.entities.HIOEntry.update(entry.id, {
          score,
          is_perfect: isPerfect
        });
      }

      // Update challenge stats
      const perfectCount = entries.filter(e => {
        let score = 0;
        for (let i = 0; i < activeChallenge.questions.length; i++) {
          if (activeChallenge.questions[i].correct_answer === e.answers[i]) {
            score++;
          }
        }
        return score === 10;
      }).length;

      await base44.entities.HIOChallenge.update(activeChallenge.id, {
        perfect_scores: perfectCount,
        status: 'settled'
      });

      return { perfectCount };
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
        <p className="text-slate-400">No active challenge. Will be created Monday at 6am GMT.</p>
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
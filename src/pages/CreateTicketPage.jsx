import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../lib/supabase.js'; // make sure this path is correct
import { ArrowLeft, Send } from 'lucide-react';

const CreateTicketPage = () => {
  const [loading, setLoading] = useState(false);
  const { profile } = useAuth();
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setError,
  } = useForm({
    defaultValues: {
      base: profile?.base || 'South',
      priority: 'Medium',
    },
  });

  const onSubmit = async (formData) => {
    try {
      setLoading(true);

      const ticketPayload = {
        title: formData.title,
        description: formData.description,
        priority: formData.priority,
        base: formData.base,
        created_by: profile.id,
        // assigned_to: null (you can add a selector if needed)
      };

      const newTicket = await db.createTicket(ticketPayload);

      // Send notification about the newly created ticket
      try {
        await db.sendNotification(
          'ticket_created',
          newTicket.id,
          'Ticket created'
        );
      } catch (notificationError) {
        console.error('Failed to send notification:', notificationError);
        // Don't block navigation if notification fails
      }

      navigate('/tickets');
    } catch (error) {
      setError('root', {
        type: 'manual',
        message: error.message || 'Something went wrong',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate('/tickets')}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="text-sm text-gray-600">Submit a new support request</p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Ticket Details</h3>
          </div>
          <div className="card-body space-y-6">
            {/* Title */}
            <div>
              <label htmlFor="title" className="form-label">Title *</label>
              <input
                id="title"
                type="text"
                className="form-input"
                placeholder="Brief description of the issue"
                {...register('title', {
                  required: 'Title is required',
                  minLength: {
                    value: 5,
                    message: 'Title must be at least 5 characters',
                  },
                })}
              />
              {errors.title && <p className="form-error">{errors.title.message}</p>}
            </div>

            {/* Description */}
            <div>
              <label htmlFor="description" className="form-label">Description *</label>
              <textarea
                id="description"
                rows={6}
                className="form-input"
                placeholder="Describe the issue in detail..."
                {...register('description', {
                  required: 'Description is required',
                  minLength: {
                    value: 20,
                    message: 'Description must be at least 20 characters',
                  },
                })}
              />
              {errors.description && <p className="form-error">{errors.description.message}</p>}
            </div>

            {/* Priority and Base */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label htmlFor="priority" className="form-label">Priority *</label>
                <select
                  id="priority"
                  className="form-input"
                  {...register('priority', { required: 'Priority is required' })}
                >
                  <option value="Low">Low</option>
                  <option value="Medium">Medium</option>
                  <option value="High">High</option>
                  <option value="Critical">Critical</option>
                </select>
                {errors.priority && <p className="form-error">{errors.priority.message}</p>}
              </div>

              <div>
                <label htmlFor="base" className="form-label">Base *</label>
                <select
                  id="base"
                  className="form-input"
                  {...register('base', { required: 'Base is required' })}
                  disabled={profile?.role !== 'Admin'}
                >
                  <option value="South">South</option>
                  <option value="BML">BML</option>
                  <option value="North">North</option>
                </select>
                {errors.base && <p className="form-error">{errors.base.message}</p>}
                {profile?.role !== 'Admin' && (
                  <p className="text-xs text-gray-500 mt-1">Based on your profile setting</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {errors.root && (
          <div className="rounded-md bg-error-50 p-4">
            <p className="text-sm text-error-700">{errors.root.message}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => navigate('/tickets')}
            className="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <div className="loading-spinner h-4 w-4 mr-2"></div>
            ) : (
              <Send className="h-4 w-4 mr-2" />
            )}
            Create Ticket
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateTicketPage;

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import { ArrowLeft, Send, AlertCircle, CheckCircle, XCircle } from "lucide-react";

const CreateTicketPage = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [allBases, setAllBases] = useState([]);
  const [userBases, setUserBases] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [validationState, setValidationState] = useState({});
  
  // Refs for performance
  const isUnmounting = useRef(false);
  const validationTimeouts = useRef({});
  
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Memoized available bases with comprehensive filtering
  const availableBases = useMemo(() => {
    if (!profile) return [];
    
    // Admins can access all bases
    if (profile.role === "Admin") {
      return allBases;
    }
    
    // For other users, filter by their assigned bases
    if (!userBases.length) return [];
    
    return allBases.filter(base => 
      userBases.some(userBase => userBase.id === base.id)
    );
  }, [allBases, userBases, profile?.role]);

  // Smart default base selection
  const defaultBaseId = useMemo(() => {
    if (!availableBases.length) return "";
    
    // If user has only one base, auto-select it
    if (availableBases.length === 1) {
      return availableBases[0].id.toString();
    }
    
    // For multiple bases, no default selection to force user choice
    return "";
  }, [availableBases]);

  // Optimized form with intelligent defaults
  const form = useForm({
    mode: "onChange", // Real-time validation
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium",
      base_id: defaultBaseId,
    },
  });

  const { register, handleSubmit, formState: { errors, isValid, isDirty }, watch, setValue, clearErrors, setError } = form;

  // Watch form values for real-time feedback
  const watchedValues = watch();
  const { title, description, priority, base_id } = watchedValues;

  // Debounced validation for better UX
  const debounceValidation = useCallback((field, value) => {
    if (validationTimeouts.current[field]) {
      clearTimeout(validationTimeouts.current[field]);
    }
    
    validationTimeouts.current[field] = setTimeout(() => {
      if (isUnmounting.current) return;
      
      let isValidField = true;
      let message = "";
      
      switch (field) {
        case "title":
          if (value && value.length < 5) {
            isValidField = false;
            message = "Title too short";
          } else if (value && value.length > 200) {
            isValidField = false;
            message = "Title too long";
          }
          break;
        case "description":
          if (value && value.length < 20) {
            isValidField = false;
            message = "Description too short";
          } else if (value && value.length > 2000) {
            isValidField = false;
            message = "Description too long";
          }
          break;
        default:
          break;
      }
      
      setValidationState(prev => ({
        ...prev,
        [field]: { isValid: isValidField, message }
      }));
    }, 300);
  }, []);

  // Real-time validation effects
  useEffect(() => {
    if (title !== undefined) debounceValidation("title", title);
  }, [title, debounceValidation]);

  useEffect(() => {
    if (description !== undefined) debounceValidation("description", description);
  }, [description, debounceValidation]);

  // Auto-set base when only one available
  useEffect(() => {
    if (defaultBaseId && !base_id && availableBases.length === 1) {
      setValue("base_id", defaultBaseId);
    }
  }, [defaultBaseId, base_id, setValue, availableBases.length]);

  // Optimized data loading with error handling
  useEffect(() => {
    let isCancelled = false;

    const loadInitialData = async () => {
      if (!profile?.id) return;

      try {
        setDataLoading(true);
        
        // Load all data in parallel for better performance
        const [basesResult, userBasesResult] = await Promise.allSettled([
          db.getAllBases(),
          profile.role === "Admin" ? Promise.resolve([]) : db.getUserBases(profile.id)
        ]);

        if (isCancelled) return;

        // Handle bases result
        if (basesResult.status === "fulfilled") {
          setAllBases(basesResult.value || []);
        } else {
          console.error("Failed to load bases:", basesResult.reason);
          toast.error("Failed to load bases");
          setAllBases([]);
        }

        // Handle user bases result
        if (userBasesResult.status === "fulfilled") {
          setUserBases(userBasesResult.value || []);
        } else {
          console.error("Failed to load user bases:", userBasesResult.reason);
          setUserBases([]);
        }

      } catch (error) {
        if (!isCancelled) {
          console.error("Failed to load initial data:", error);
          toast.error("Failed to load form data");
        }
      } finally {
        if (!isCancelled) {
          setDataLoading(false);
        }
      }
    };

    loadInitialData();

    return () => {
      isCancelled = true;
      isUnmounting.current = true;
    };
  }, [profile?.id, profile?.role]);

  // Optimized form submission with comprehensive error handling
  const onSubmit = useCallback(async (formData) => {
  try {
    setLoading(true);
    clearErrors();

    // Client-side validation
    const selectedBase = availableBases.find(base => base.id === parseInt(formData.base_id));
    if (!selectedBase) {
      setError("base_id", {
        type: "validation",
        message: "Please select a valid base"
      });
      return;
    }

    // Prepare optimized payload
    const ticketPayload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      priority: formData.priority,
      base_id: parseInt(formData.base_id),
      created_by: profile.id,
      status: "Open",
    };

    console.log("🎫 Creating ticket with payload:", ticketPayload);

    // MISSING: Actually create the ticket!
    const newTicket = await db.createTicket(ticketPayload);

    if (!newTicket?.id) {
      throw new Error("Failed to create ticket - no ID returned");
    }

    // Success feedback
    toast.success("Ticket created successfully!");

    // ENHANCED: Send notification to admins using the new system
    Promise.resolve().then(async () => {
      try {
        await db.sendTicketCreatedNotification(newTicket, profile.id);
        console.log('✅ Admin notification sent for new ticket');
      } catch (notificationError) {
        console.warn("Background notification failed:", notificationError);
        // Don't show error to user for background operations
      }
    });

    // Navigate to the new ticket
    navigate(`/tickets/${newTicket.id}`);

  } catch (error) {
    console.error("❌ Error creating ticket:", error);
    
    // Handle specific error cases
    if (error.message?.includes("base_id")) {
      setError("base_id", {
        type: "server",
        message: "Invalid base selection"
      });
    } else if (error.message?.includes("permission") || error.message?.includes("access")) {
      setError("root", {
        type: "permission",
        message: "You don't have permission to create tickets for this base"
      });
    } else if (error.message?.includes("network") || error.message?.includes("fetch")) {
      setError("root", {
        type: "network",
        message: "Network error. Please check your connection and try again."
      });
    } else {
      setError("root", {
        type: "server",
        message: error.message || "Failed to create ticket. Please try again."
      });
    }
    
    toast.error("Failed to create ticket");
  } finally {
    setLoading(false);
  }
}, [profile?.id, availableBases, navigate, setError, clearErrors]);

  // Memoized form validation helpers
  const getFieldIcon = useCallback((fieldName) => {
    const validation = validationState[fieldName];
    const value = watchedValues[fieldName];
    
    if (!value) return null;
    
    if (validation?.isValid === false) {
      return <XCircle className="h-4 w-4 text-red-500" />;
    }
    
    if (value && !errors[fieldName]) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    return null;
  }, [validationState, watchedValues, errors]);

  // Character counter component
  const CharacterCounter = ({ current, max, className = "" }) => {
    const percentage = (current / max) * 100;
    const colorClass = percentage > 90 ? "text-red-500" : percentage > 75 ? "text-yellow-500" : "text-gray-500";
    
    return (
      <span className={`text-xs ${colorClass} ${className}`}>
        {current}/{max}
      </span>
    );
  };

  // Loading state with skeleton
  if (dataLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/tickets")}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
            <p className="text-sm text-gray-600">Loading form data...</p>
          </div>
        </div>
        
        {/* Skeleton loader */}
        <div className="card">
          <div className="card-header">
            <div className="h-6 bg-gray-200 rounded w-1/3 animate-pulse"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3 mt-2 animate-pulse"></div>
          </div>
          <div className="card-body space-y-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="space-y-2">
                <div className="h-4 bg-gray-200 rounded w-1/4 animate-pulse"></div>
                <div className="h-10 bg-gray-200 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // No access state
  if (!availableBases.length) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate("/tickets")}
            className="p-2 text-gray-400 hover:text-gray-600 rounded-md"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
            <p className="text-sm text-gray-600">Access restricted</p>
          </div>
        </div>
        
        <div className="card">
          <div className="card-body text-center py-8">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-yellow-500" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              No Bases Available
            </h3>
            <p className="text-gray-600 mb-4">
              You don't have access to any bases. Contact an administrator to assign you to a base.
            </p>
            <button
              onClick={() => navigate("/tickets")}
              className="btn-secondary"
            >
              Back to Tickets
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate("/tickets")}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md transition-colors"
          disabled={loading}
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Create New Ticket</h1>
          <p className="text-sm text-gray-600">Submit a new support request</p>
        </div>
        {/* Progress indicator */}
        <div className="text-right">
          <div className="text-xs text-gray-500">
            Form {isValid ? "✓" : "○"} {isDirty ? "Modified" : ""}
          </div>
        </div>
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="card">
          <div className="card-header">
            <h3 className="text-lg font-medium text-gray-900">Ticket Information</h3>
            <p className="text-sm text-gray-600">
              Please provide detailed information about your request
            </p>
          </div>
          
          <div className="card-body space-y-6">
            {/* Title Field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="title" className="form-label">
                  Title <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  {getFieldIcon("title")}
                  <CharacterCounter current={title?.length || 0} max={200} />
                </div>
              </div>
              
              <input
                id="title"
                type="text"
                className={`form-input ${errors.title ? "border-red-300 focus:ring-red-500" : 
                  validationState.title?.isValid === false ? "border-yellow-300 focus:ring-yellow-500" :
                  title && !errors.title ? "border-green-300 focus:ring-green-500" : ""
                }`}
                placeholder="Brief, descriptive title of your issue"
                disabled={loading}
                {...register("title", {
                  required: "Title is required",
                  minLength: { value: 5, message: "Title must be at least 5 characters" },
                  maxLength: { value: 200, message: "Title must be less than 200 characters" },
                  pattern: {
                    value: /^(?!\s*$).+/,
                    message: "Title cannot be empty or just whitespace"
                  }
                })}
              />
              
              {errors.title && (
                <p className="form-error">{errors.title.message}</p>
              )}
              {validationState.title?.message && !errors.title && (
                <p className="text-xs text-yellow-600 mt-1">{validationState.title.message}</p>
              )}
            </div>

            {/* Description Field */}
            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="description" className="form-label">
                  Description <span className="text-red-500">*</span>
                </label>
                <div className="flex items-center space-x-2">
                  {getFieldIcon("description")}
                  <CharacterCounter current={description?.length || 0} max={2000} />
                </div>
              </div>
              
              <textarea
                id="description"
                rows={6}
                className={`form-input ${errors.description ? "border-red-300 focus:ring-red-500" : 
                  validationState.description?.isValid === false ? "border-yellow-300 focus:ring-yellow-500" :
                  description && !errors.description ? "border-green-300 focus:ring-green-500" : ""
                }`}
                placeholder="Please describe your issue in detail. Include steps to reproduce, error messages, and any relevant context..."
                disabled={loading}
                {...register("description", {
                  required: "Description is required",
                  minLength: { value: 20, message: "Description must be at least 20 characters" },
                  maxLength: { value: 2000, message: "Description must be less than 2000 characters" },
                  pattern: {
                    value: /^(?!\s*$).+/,
                    message: "Description cannot be empty or just whitespace"
                  }
                })}
              />
              
              {errors.description && (
                <p className="form-error">{errors.description.message}</p>
              )}
              {validationState.description?.message && !errors.description && (
                <p className="text-xs text-yellow-600 mt-1">{validationState.description.message}</p>
              )}
            </div>

            {/* Priority and Base Row */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Priority Field */}
              <div>
                <label htmlFor="priority" className="form-label">
                  Priority <span className="text-red-500">*</span>
                </label>
                <select
                  id="priority"
                  className={`form-input ${errors.priority ? "border-red-300 focus:ring-red-500" : ""}`}
                  disabled={loading}
                  {...register("priority", { required: "Priority is required" })}
                >
                  <option value="Low">🟢 Low - General questions</option>
                  <option value="Medium">🟡 Medium - Standard issues</option>
                  <option value="High">🟠 High - Urgent problems</option>
                  <option value="Critical">🔴 Critical - System down</option>
                </select>
                {errors.priority && (
                  <p className="form-error">{errors.priority.message}</p>
                )}
              </div>

              {/* Base Field */}
              <div>
                <label htmlFor="base_id" className="form-label">
                  Base <span className="text-red-500">*</span>
                </label>
                <select
                  id="base_id"
                  className={`form-input ${errors.base_id ? "border-red-300 focus:ring-red-500" : ""}`}
                  disabled={loading || availableBases.length === 1}
                  {...register("base_id", {
                    required: "Base selection is required",
                    validate: value => {
                      if (!value) return "Please select a base";
                      const exists = availableBases.some(base => base.id === parseInt(value));
                      return exists || "Invalid base selection";
                    }
                  })}
                >
                  <option value="">-- Select Base --</option>
                  {availableBases.map(base => (
                    <option key={base.id} value={base.id}>
                      {base.name}
                    </option>
                  ))}
                </select>
                
                {errors.base_id && (
                  <p className="form-error">{errors.base_id.message}</p>
                )}
                
                {/* Helper text */}
                <div className="text-xs text-gray-500 mt-1">
                  {availableBases.length === 1 && "Auto-selected (only available base)"}
                  {profile?.role === "Admin" && availableBases.length > 1 && "Admin: Can create tickets for any base"}
                  {profile?.role !== "Admin" && availableBases.length > 1 && `${availableBases.length} bases available`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Error Display */}
        {errors.root && (
          <div className="rounded-md bg-red-50 border border-red-200 p-4">
            <div className="flex items-center">
              <AlertCircle className="h-5 w-5 text-red-400 mr-2 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800">Submission Error</h4>
                <p className="text-sm text-red-700 mt-1">{errors.root.message}</p>
              </div>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between items-center">
          <div className="text-sm text-gray-500">
            {isDirty && "● Unsaved changes"}
          </div>
          
          <div className="flex space-x-4">
            <button
              type="button"
              onClick={() => navigate("/tickets")}
              className="btn-secondary"
              disabled={loading}
            >
              Cancel
            </button>
            
            <button
              type="submit"
              disabled={loading || !isValid || !isDirty}
              className="btn-primary"
            >
              {loading ? (
                <>
                  <div className="loading-spinner h-4 w-4 mr-2"></div>
                  Creating...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4 mr-2" />
                  Create Ticket
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateTicketPage;
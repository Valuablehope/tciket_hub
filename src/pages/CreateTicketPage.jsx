import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { useAuth } from "../contexts/AuthContext";
import { db } from "../lib/supabase.js";
import { toast } from "react-hot-toast";
import { ArrowLeft, Send, AlertCircle, CheckCircle, XCircle, Upload, X, Image, FileImage } from "lucide-react";

const CreateTicketPage = () => {
  // State management
  const [loading, setLoading] = useState(false);
  const [allBases, setAllBases] = useState([]);
  const [userBases, setUserBases] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [validationState, setValidationState] = useState({});
  
  // Screenshot upload state
  const [screenshots, setScreenshots] = useState([]);
  const [uploadProgress, setUploadProgress] = useState({});
  const [dragActive, setDragActive] = useState(false);
  
  // Refs for performance
  const isUnmounting = useRef(false);
  const validationTimeouts = useRef({});
  const fileInputRef = useRef(null);
  
  const { profile } = useAuth();
  const navigate = useNavigate();

  // Configuration constants
  const MAX_FILES = 5;
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ACCEPTED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

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

  // File validation helper
  const validateFile = useCallback((file) => {
    const errors = [];
    
    if (!ACCEPTED_TYPES.includes(file.type)) {
      errors.push(`${file.name}: Invalid file type. Only images are allowed.`);
    }
    
    if (file.size > MAX_FILE_SIZE) {
      errors.push(`${file.name}: File too large. Maximum size is 10MB.`);
    }
    
    return errors;
  }, []);

  // Optimized file processing
  const processFiles = useCallback(async (files) => {
    const fileArray = Array.from(files);
    const totalFiles = screenshots.length + fileArray.length;
    
    if (totalFiles > MAX_FILES) {
      toast.error(`Maximum ${MAX_FILES} screenshots allowed. You're trying to add ${fileArray.length} more to existing ${screenshots.length}.`);
      return;
    }

    const validationErrors = [];
    const validFiles = [];

    fileArray.forEach(file => {
      const errors = validateFile(file);
      if (errors.length > 0) {
        validationErrors.push(...errors);
      } else {
        validFiles.push(file);
      }
    });

    if (validationErrors.length > 0) {
      toast.error(validationErrors.join('\n'));
      return;
    }

    if (validFiles.length === 0) return;

    // Process valid files
    for (const file of validFiles) {
      const fileId = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      try {
        // Create preview URL
        const previewUrl = URL.createObjectURL(file);
        
        // Add to screenshots state immediately for better UX
        const newScreenshot = {
          id: fileId,
          file,
          previewUrl,
          name: file.name,
          size: file.size,
          uploading: false,
          uploaded: false,
          url: null
        };

        setScreenshots(prev => [...prev, newScreenshot]);
        
      } catch (error) {
        console.error('Error processing file:', error);
        toast.error(`Failed to process ${file.name}`);
      }
    }
  }, [screenshots.length, validateFile]);

  // Drag and drop handlers
  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setDragActive(false);
    }
  }, []);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    const files = e.dataTransfer.files;
    if (files?.length > 0) {
      processFiles(files);
    }
  }, [processFiles]);

  // File input handler
  const handleFileInput = useCallback((e) => {
    const files = e.target.files;
    if (files?.length > 0) {
      processFiles(files);
    }
    // Reset input to allow re-selecting same files
    e.target.value = '';
  }, [processFiles]);

  // Remove screenshot
  const removeScreenshot = useCallback((screenshotId) => {
    setScreenshots(prev => {
      const updated = prev.filter(s => s.id !== screenshotId);
      // Clean up object URLs to prevent memory leaks
      const removed = prev.find(s => s.id === screenshotId);
      if (removed?.previewUrl) {
        URL.revokeObjectURL(removed.previewUrl);
      }
      return updated;
    });
  }, []);

  // Upload screenshots to Supabase Storage
  const uploadScreenshots = useCallback(async (ticketId) => {
    if (screenshots.length === 0) return [];

    const uploadedUrls = [];
    
    for (const screenshot of screenshots) {
      if (screenshot.uploaded) {
        uploadedUrls.push(screenshot.url);
        continue;
      }

      try {
        setUploadProgress(prev => ({ ...prev, [screenshot.id]: 0 }));
        
        // Generate unique filename
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substr(2, 9);
        const fileExtension = screenshot.file.name.split('.').pop();
        const fileName = `${ticketId}/${timestamp}_${randomId}.${fileExtension}`;
        
        // Upload to Supabase Storage
        const { data, error } = await db.uploadTicketAttachment(fileName, screenshot.file);
        
        if (error) throw error;
        
        setUploadProgress(prev => ({ ...prev, [screenshot.id]: 100 }));
        
        // Get public URL
        const { publicUrl } = db.getTicketAttachmentUrl(fileName);
if (publicUrl) {
  uploadedUrls.push(publicUrl);
} else {
  console.warn("⚠️ No public URL returned for file:", fileName);
}

        
        // Update screenshot state
        setScreenshots(prev => prev.map(s => 
          s.id === screenshot.id 
            ? { ...s, uploaded: true, url: publicUrl, uploading: false }
            : s
        ));
        
      } catch (error) {
        console.error(`Failed to upload ${screenshot.name}:`, error);
        setUploadProgress(prev => ({ ...prev, [screenshot.id]: -1 })); // Error state
        toast.error(`Failed to upload ${screenshot.name}`);
      }
    }
    
    return uploadedUrls;
  }, [screenshots]);

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

  // Cleanup effect for object URLs
  useEffect(() => {
    return () => {
      screenshots.forEach(screenshot => {
        if (screenshot.previewUrl) {
          URL.revokeObjectURL(screenshot.previewUrl);
        }
      });
    };
  }, [screenshots]);

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

      // Create the ticket first
      const newTicket = await db.createTicket(ticketPayload);

      if (!newTicket?.id) {
        throw new Error("Failed to create ticket - no ID returned");
      }

      // Upload screenshots if any
      let uploadedUrls = [];
      if (screenshots.length > 0) {
        toast.loading(`Uploading ${screenshots.length} screenshot(s)...`);
        uploadedUrls = await uploadScreenshots(newTicket.id);
        toast.dismiss();
        
        if (uploadedUrls.length > 0) {
          // Update ticket with attachment URLs
          await db.updateTicket(newTicket.id, {
            attachments: uploadedUrls
          });
          toast.success(`${uploadedUrls.length} screenshot(s) uploaded successfully!`);
        }
      }

      // Success feedback
      toast.success("Ticket created successfully!");

      // Send notification to admins using the new system
      Promise.resolve().then(async () => {
        try {
          await db.sendTicketCreatedNotification(newTicket, profile.id);
          console.log('✅ Admin notification sent for new ticket');
        } catch (notificationError) {
          console.warn("Background notification failed:", notificationError);
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
  }, [profile?.id, availableBases, navigate, setError, clearErrors, screenshots, uploadScreenshots]);

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

  // Screenshot preview component
  const ScreenshotPreview = ({ screenshot, onRemove }) => {
    const progress = uploadProgress[screenshot.id];
    const hasError = progress === -1;
    
    return (
      <div className="relative group bg-gray-50 rounded-lg p-2 border border-gray-200">
        <div className="aspect-square w-20 h-20 rounded-md overflow-hidden bg-gray-100 flex items-center justify-center">
          <img
            src={screenshot.previewUrl}
            alt={screenshot.name}
            className="w-full h-full object-cover"
            onError={(e) => {
              e.target.style.display = 'none';
              e.target.parentNode.innerHTML = '<FileImage className="h-8 w-8 text-gray-400" />';
            }}
          />
        </div>
        
        {/* Progress indicator */}
        {progress !== undefined && progress >= 0 && progress < 100 && (
          <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
            <div className="text-white text-xs font-medium">{progress}%</div>
          </div>
        )}
        
        {/* Error indicator */}
        {hasError && (
          <div className="absolute inset-0 bg-red-500 bg-opacity-75 rounded-lg flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-white" />
          </div>
        )}
        
        {/* Success indicator */}
        {screenshot.uploaded && (
          <div className="absolute top-1 left-1">
            <CheckCircle className="h-4 w-4 text-green-500 bg-white rounded-full" />
          </div>
        )}
        
        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(screenshot.id)}
          className="absolute -top-1 -right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          disabled={loading}
        >
          <X className="h-3 w-3" />
        </button>
        
        {/* File name */}
        <div className="mt-1 text-xs text-gray-600 truncate" title={screenshot.name}>
          {screenshot.name}
        </div>
        
        {/* File size */}
        <div className="text-xs text-gray-400">
          {(screenshot.size / 1024 / 1024).toFixed(1)}MB
        </div>
      </div>
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
            {screenshots.length > 0 && ` • ${screenshots.length} screenshot(s)`}
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

            {/* Screenshots Upload Section */}
            <div>
              <label className="form-label">
                Screenshots <span className="text-gray-500">(Optional)</span>
              </label>
              <p className="text-sm text-gray-600 mb-3">
                Add screenshots to help explain your issue. Max {MAX_FILES} files, 10MB each.
              </p>
              
              {/* Drop zone */}
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                  dragActive
                    ? "border-blue-400 bg-blue-50"
                    : "border-gray-300 hover:border-gray-400"
                } ${loading ? "opacity-50 pointer-events-none" : ""}`}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept={ACCEPTED_TYPES.join(',')}
                  onChange={handleFileInput}
                  className="hidden"
                  disabled={loading}
                />
                
                <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-lg font-medium text-gray-900 mb-2">
                  Drop screenshots here or click to browse
                </p>
                <p className="text-sm text-gray-600 mb-4">
                  Supports: JPG, PNG, GIF, WebP (max 10MB each)
                </p>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="btn-secondary"
                  disabled={loading || screenshots.length >= MAX_FILES}
                >
                  <Image className="h-4 w-4 mr-2" />
                  Choose Files
                </button>
              </div>
              
              {/* Screenshot previews */}
              {screenshots.length > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm font-medium text-gray-700">
                      Screenshots ({screenshots.length}/{MAX_FILES})
                    </span>
                    {screenshots.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          screenshots.forEach(s => s.previewUrl && URL.revokeObjectURL(s.previewUrl));
                          setScreenshots([]);
                          setUploadProgress({});
                        }}
                        className="text-sm text-red-600 hover:text-red-800"
                        disabled={loading}
                      >
                        Remove All
                      </button>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {screenshots.map(screenshot => (
                      <ScreenshotPreview
                        key={screenshot.id}
                        screenshot={screenshot}
                        onRemove={removeScreenshot}
                      />
                    ))}
                  </div>
                </div>
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
            {screenshots.length > 0 && ` • ${screenshots.length} screenshot(s) ready`}
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
                  {screenshots.length > 0 ? "Creating & Uploading..." : "Creating..."}
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
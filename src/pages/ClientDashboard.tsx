import React, { useState, useEffect } from 'react';
import { User, Briefcase, CreditCard, MessageSquare, Shield, Edit3, Save, X, CheckCircle, Plus, Send, Bot, Clock, AlertCircle, FileText, Target, Users, DollarSign, Palette, Calendar, Zap, Monitor, Settings, Copy, RefreshCw, Download, FolderPlus, History, Trash2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut, getProjectConversations, getProjectConversation, saveProjectConversation, deleteProjectConversation } from '../lib/supabase';
import ChecklistDisplay from '../components/ChecklistDisplay';
import SignatureBox from '../components/SignatureBox';
import ConfirmationBanner from '../components/ConfirmationBanner';

interface ProfileData {
  fullName: string;
  email: string;
  mobileNumber: string;
  countryCode: string;
  companyName: string;
  gstNumber: string;
  clientId: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Parameter {
  id: string;
  label: string;
  value: string;
  category: 'content' | 'technical' | 'business' | 'timeline';
}

interface Signature {
  name: string;
  date: string;
  timestamp: Date | null;
}

interface ProjectConversation {
  id: string;
  project_id: string;
  project_name: string;
  messages: Message[];
  parameters_collected: number;
  status: string;
  created_at: string;
  updated_at: string;
}

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    companyName: '',
    gstNumber: '',
    clientId: ''
  });
  const [originalData, setOriginalData] = useState<ProfileData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    companyName: '',
    gstNumber: '',
    clientId: ''
  });
  const [errors, setErrors] = useState<Partial<ProfileData>>({});

  // Project Creation State
  const [conversation, setConversation] = useState<Message[]>([]);
  const [currentMessage, setCurrentMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [collectedParameters, setCollectedParameters] = useState(0);
  const [extractedParameters, setExtractedParameters] = useState<Parameter[]>([]);
  const [showChecklist, setShowChecklist] = useState(false);
  const [isGeneratingChecklist, setIsGeneratingChecklist] = useState(false);
  
  // Project Management State
  const [currentProjectId, setCurrentProjectId] = useState<string>('');
  const [currentProjectName, setCurrentProjectName] = useState<string>('');
  const [savedProjects, setSavedProjects] = useState<ProjectConversation[]>([]);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  
  // Digital Agreement State
  const [clientSignature, setClientSignature] = useState<Signature>({
    name: '',
    date: '',
    timestamp: null
  });
  const [freelancerSignature, setFreelancerSignature] = useState<Signature>({
    name: '',
    date: '',
    timestamp: null
  });
  const [isAgreementLocked, setIsAgreementLocked] = useState(false);
  const [agreementTimestamp, setAgreementTimestamp] = useState<Date | null>(null);
  const [projectId, setProjectId] = useState<string | null>(null);

  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' },
    { code: '+86', country: 'China', flag: '🇨🇳' },
    { code: '+81', country: 'Japan', flag: '🇯🇵' },
    { code: '+49', country: 'Germany', flag: '🇩🇪' },
    { code: '+33', country: 'France', flag: '🇫🇷' },
    { code: '+61', country: 'Australia', flag: '🇦🇺' }
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'projects', label: 'Projects', icon: Briefcase },
    { id: 'create-project', label: 'Create Project', icon: Plus },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'messages', label: 'Messages', icon: MessageSquare }
  ];

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { user } = await getCurrentUser();
        if (user) {
          // Load user profile from database
          const { getUserProfile } = await import('../lib/supabase');
          const { data: profile, error } = await getUserProfile();
          
          if (error) {
            console.error('Error loading profile:', error);
            // Set basic data from auth user
            setProfileData(prev => ({ ...prev, email: user.email || '' }));
            setOriginalData(prev => ({ ...prev, email: user.email || '' }));
          } else if (profile) {
            // Set data from database profile
            const profileData = {
              fullName: profile.full_name || '',
              email: user.email || '',
              mobileNumber: profile.mobile_number || '',
              countryCode: profile.country_code || '+91',
              companyName: profile.company_name || '',
              gstNumber: profile.gst_number || '',
              clientId: profile.client_id || ''
            };
            setProfileData(profileData);
            setOriginalData(profileData);
            setIsNewUser(!profile.profile_completed);
            if (profile.updated_at) {
              setLastUpdated(new Date(profile.updated_at));
            }
          } else {
            // No profile exists, set basic data
            setProfileData(prev => ({ ...prev, email: user.email || '' }));
            setOriginalData(prev => ({ ...prev, email: user.email || '' }));
          }
          
          // Load saved project conversations
          await loadSavedProjects();
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Load saved project conversations
  const loadSavedProjects = async () => {
    try {
      const { data, error } = await getProjectConversations();
      if (error) {
        console.error('Error loading projects:', error);
        return;
      }
      if (data) {
        setSavedProjects(data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
    }
  };

  // Generate unique project ID
  const generateProjectId = () => {
    return `proj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  // Start new project
  const startNewProject = async () => {
    if (!newProjectName.trim()) {
      setError('Please enter a project name');
      return;
    }

    const projectId = generateProjectId();
    const welcomeMessage: Message = {
      id: 'welcome',
      role: 'assistant',
      content: "Hello! I'm your AI project assistant. I'll help you create a detailed checklist for your project by asking you some questions. Let's start - what kind of project are you planning?",
      timestamp: new Date()
    };

    try {
      await saveProjectConversation(projectId, newProjectName.trim(), [welcomeMessage], 0, 'active');
      
      setCurrentProjectId(projectId);
      setCurrentProjectName(newProjectName.trim());
      setConversation([welcomeMessage]);
      setCollectedParameters(0);
      setShowChecklist(false);
      setExtractedParameters([]);
      setShowNewProjectModal(false);
      setNewProjectName('');
      
      await loadSavedProjects();
    } catch (error) {
      console.error('Error creating new project:', error);
      setError('Failed to create new project');
    }
  };

  // Load existing project
  const loadProject = async (projectId: string) => {
    try {
      const { data, error } = await getProjectConversation(projectId);
      if (error) {
        console.error('Error loading project:', error);
        setError('Failed to load project');
        return;
      }
      
      if (data) {
        setCurrentProjectId(data.project_id);
        setCurrentProjectName(data.project_name || '');
        setConversation(data.messages || []);
        setCollectedParameters(data.parameters_collected || 0);
        setShowChecklist(false);
        setExtractedParameters([]);
        setShowProjectSelector(false);
      }
    } catch (error) {
      console.error('Error loading project:', error);
      setError('Failed to load project');
    }
  };

  // Save current conversation
  const saveCurrentConversation = async () => {
    if (!currentProjectId || !currentProjectName) return;
    
    try {
      await saveProjectConversation(
        currentProjectId,
        currentProjectName,
        conversation,
        collectedParameters,
        'active'
      );
    } catch (error) {
      console.error('Error saving conversation:', error);
    }
  };

  // Delete project
  const deleteProject = async (projectId: string) => {
    if (!confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await deleteProjectConversation(projectId);
      if (error) {
        console.error('Error deleting project:', error);
        setError('Failed to delete project');
        return;
      }
      
      // If we're deleting the current project, reset the state
      if (projectId === currentProjectId) {
        setCurrentProjectId('');
        setCurrentProjectName('');
        setConversation([]);
        setCollectedParameters(0);
        setShowChecklist(false);
        setExtractedParameters([]);
      }
      
      await loadSavedProjects();
    } catch (error) {
      console.error('Error deleting project:', error);
      setError('Failed to delete project');
    }
  };
  // Calculate profile completion percentage
  const calculateCompletion = () => {
    const fields = ['fullName', 'mobileNumber', 'companyName'];
    const completed = fields.filter(field => profileData[field as keyof ProfileData].trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  // Generate unique client ID based on email
  const generateClientId = (email: string) => {
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    
    const positiveHash = Math.abs(hash);
    const nineDigitId = String(positiveHash).padStart(9, '0').slice(0, 9);
    return `C${nineDigitId}`;
  };

  // Handle input changes
  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Format GST number
  const formatGST = (value: string) => {
    return value.replace(/[^A-Z0-9]/g, '').slice(0, 15);
  };

  // Validate form fields
  const validateForm = () => {
    const newErrors: Partial<ProfileData> = {};

    if (!profileData.fullName.trim()) {
      newErrors.fullName = 'Full name is required';
    }

    if (!profileData.mobileNumber.trim()) {
      newErrors.mobileNumber = 'Mobile number is required';
    } else if (!/^\d{10}$/.test(profileData.mobileNumber)) {
      newErrors.mobileNumber = 'Please enter a valid 10-digit mobile number';
    }

    if (!profileData.companyName.trim()) {
      newErrors.companyName = 'Company name is required';
    }

    if (profileData.gstNumber && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(profileData.gstNumber)) {
      newErrors.gstNumber = 'Please enter a valid GST number';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save changes
  const handleSave = async () => {
    if (validateForm()) {
      try {
        const { updateUserProfile } = await import('../lib/supabase');
        
        const profileUpdateData = {
          user_type: 'client',
          full_name: profileData.fullName,
          mobile_number: profileData.mobileNumber,
          country_code: profileData.countryCode,
          company_name: profileData.companyName,
          gst_number: profileData.gstNumber,
          profile_completed: true
        };
        
        const { data, error } = await updateUserProfile(profileUpdateData);
        
        if (error) {
          console.error('Error saving profile:', error);
          // Handle error - you might want to show a toast notification
          return;
        }
        
        if (data) {
          // Update local state with saved data
          const updatedProfileData = {
            ...profileData,
            clientId: data.client_id || profileData.clientId
          };
          setProfileData(updatedProfileData);
          setOriginalData(updatedProfileData);
          setHasChanges(false);
          setIsEditing(false);
          setLastUpdated(new Date());
          setIsNewUser(false);
        }
      } catch (error) {
        console.error('Error saving profile:', error);
      }
    }
  };

  // Handle cancel changes
  const handleCancel = () => {
    setProfileData({ ...originalData });
    setHasChanges(false);
    setIsEditing(false);
    setErrors({});
  };

  // Handle logout
  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Real function to call OpenAI via Supabase Edge Function
  const fetchChecklistFromGPT = async (conversationHistory: Message[]): Promise<{ reply: string; detectedParameters: number }> => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration missing');
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/fetchChecklistFromGPT`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({
        messages: conversationHistory.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      reply: data.reply,
      detectedParameters: data.detectedParameters || 0
    };
  };

  // Handle sending a message
  const handleSendMessage = async () => {
    if (!currentMessage.trim() || isLoading) return;

    // Ensure we have a current project
    if (!currentProjectId) {
      setError('Please start a new project first');
      return;
    }
    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: currentMessage.trim(),
      timestamp: new Date()
    };

    // Add user message to conversation
    const updatedConversation = [...conversation, userMessage];
    setConversation(updatedConversation);
    setCurrentMessage('');
    setIsLoading(true);
    setError(null);

    try {
      // Fetch response from OpenAI via Edge Function
      const { reply, detectedParameters } = await fetchChecklistFromGPT(updatedConversation);
      
      // Clean up the reply by removing JSON metadata - handle multiple formats
      let cleanReply = reply
        .replace(/```json\s*\n.*?\n```/gs, '') // Remove ```json blocks
        .replace(/Here's a JSON object showing our progress:/g, '') // Remove intro text
        .replace(/\s*\{\s*"parameters_collected":\s*\d+\s*\}\s*/g, '') // Remove inline JSON
        .trim();
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: cleanReply,
        timestamp: new Date()
      };

      // Add assistant message to conversation
      const finalConversation = [...updatedConversation, assistantMessage];
      setConversation(finalConversation);
      
      // Update collected parameters from API response
      setCollectedParameters(detectedParameters);
      
      // Save conversation to database
      await saveProjectConversation(
        currentProjectId,
        currentProjectName,
        finalConversation,
        detectedParameters,
        'active'
      );
      
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get response. Please try again.');
      console.error('Error fetching response:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle key press in message input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Generate final checklist
  const generateFinalChecklist = async () => {
    setIsGeneratingChecklist(true);
    setError(null);

    try {
      // Extract parameters from conversation (simplified extraction)
      const mockParameters: Parameter[] = [
        {
          id: '1',
          label: 'Project Type',
          value: 'Animation-based reel video',
          category: 'content'
        },
        {
          id: '2',
          label: 'Target Audience',
          value: 'Social media users, potential clients',
          category: 'content'
        },
        {
          id: '3',
          label: 'Video Duration',
          value: '15-30 seconds (Instagram Reel format)',
          category: 'technical'
        },
        {
          id: '4',
          label: 'Animation Style',
          value: '2D motion graphics with modern design',
          category: 'technical'
        },
        {
          id: '5',
          label: 'Budget Range',
          value: '$500 - $1000',
          category: 'business'
        },
        {
          id: '6',
          label: 'Timeline',
          value: '7 days for completion',
          category: 'timeline'
        },
        {
          id: '7',
          label: 'Deliverable Format',
          value: 'MP4, 1080x1920 (9:16 aspect ratio)',
          category: 'technical'
        },
        {
          id: '8',
          label: 'Revision Rounds',
          value: '2 rounds of revisions included',
          category: 'business'
        },
        {
          id: '9',
          label: 'Music Requirements',
          value: 'Trending background music, royalty-free',
          category: 'content'
        },
        {
          id: '10',
          label: 'Brand Guidelines',
          value: 'Company logo and brand colors to be included',
          category: 'content'
        },
        {
          id: '11',
          label: 'Distribution Channels',
          value: 'Instagram, Facebook, LinkedIn',
          category: 'business'
        },
        {
          id: '12',
          label: 'Success Metrics',
          value: 'Engagement rate, view completion rate',
          category: 'business'
        },
        {
          id: '13',
          label: 'Script Requirements',
          value: 'Client to provide script and key messaging',
          category: 'content'
        },
        {
          id: '14',
          label: 'Voiceover Needs',
          value: 'No voiceover required, text overlays only',
          category: 'technical'
        }
      ];

      setExtractedParameters(mockParameters);
      setShowChecklist(true);

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate checklist. Please try again.');
      console.error('Error generating checklist:', err);
    } finally {
      setIsGeneratingChecklist(false);
    }
  };

  // Handle agreement confirmation
  const handleConfirmAgreement = async () => {
    if (!clientSignature.timestamp || !freelancerSignature.timestamp) {
      setError('Both parties must sign the agreement before it can be locked.');
      return;
    }

    try {
      // Generate project ID
      const newProjectId = `P${Date.now().toString().slice(-8)}`;
      
      // In a real implementation, you would save to Supabase here
      // const { data, error } = await supabase
      //   .from('finalized_projects')
      //   .insert({
      //     project_id: newProjectId,
      //     client_id: profileData.clientId,
      //     parameters: extractedParameters,
      //     client_signature: clientSignature,
      //     freelancer_signature: freelancerSignature,
      //     locked_at: new Date().toISOString()
      //   });

      setProjectId(newProjectId);
      setIsAgreementLocked(true);
      setAgreementTimestamp(new Date());
      
    } catch (err) {
      setError('Failed to finalize agreement. Please try again.');
      console.error('Error finalizing agreement:', err);
    }
  };

  // Handle download agreement
  const handleDownloadAgreement = () => {
    // In a real implementation, this would generate and download a PDF
    alert('Agreement download feature coming soon!');
  };

  // Initialize conversation
  useEffect(() => {
    if (activeTab === 'create-project' && conversation.length === 0 && !currentProjectId) {
      // Show new project modal if no current project
      setShowNewProjectModal(true);
    }
  }, [activeTab, conversation.length, currentProjectId]);

  const renderProfileContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Banner for New Users */}
      {isNewUser && (
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border border-purple-500/30 rounded-2xl p-4 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-purple-400" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Welcome to SecureServe! 🎉
              </h2>
              <p className="text-sm sm:text-base text-gray-300 mb-4">
                Please complete your profile information to start creating projects and hiring freelancers.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-32 bg-gray-700 rounded-full h-2">
                    <div 
                      className="bg-gradient-to-r from-purple-400 to-pink-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${calculateCompletion()}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-purple-400 whitespace-nowrap">
                    {calculateCompletion()}% Complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Profile Form */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <h2 className="text-xl sm:text-2xl font-bold text-white">Profile Information</h2>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-auto"
            >
              <Edit3 className="h-4 w-4" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Client ID */}
          <div className="lg:col-span-2">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Client ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={profileData.clientId || 'Will be assigned after profile completion'}
                disabled
                className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60 text-sm sm:text-base"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
            </div>
          </div>

          {/* Full Name */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Full Name *
            </label>
            <input
              type="text"
              value={profileData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="Enter your full name"
              disabled={!isEditing}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.fullName 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-purple-400'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {errors.fullName && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.fullName}</p>
            )}
          </div>

          {/* Email Address (Read-only) */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Email Address
            </label>
            <input
              type="email"
              value={profileData.email}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60 text-sm sm:text-base"
            />
          </div>

          {/* Mobile Number */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Mobile Number *
            </label>
            <div className="flex space-x-2">
              <select
                value={profileData.countryCode}
                onChange={(e) => handleInputChange('countryCode', e.target.value)}
                disabled={!isEditing}
                className={`px-2 sm:px-3 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white text-sm sm:text-base border-gray-600 focus:border-purple-400 ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {countryCodes.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                value={profileData.mobileNumber}
                onChange={(e) => handleInputChange('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit mobile number"
                disabled={!isEditing}
                maxLength={10}
                className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  errors.mobileNumber 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-purple-400'
                } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            {errors.mobileNumber && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.mobileNumber}</p>
            )}
          </div>

          {/* Company Name */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Company Name *
            </label>
            <input
              type="text"
              value={profileData.companyName}
              onChange={(e) => handleInputChange('companyName', e.target.value)}
              placeholder="Enter your company name"
              disabled={!isEditing}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.companyName 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-purple-400'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {errors.companyName && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          {/* GST Number (Optional) */}
          <div className="lg:col-span-2">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              GST Number (Optional)
            </label>
            <input
              type="text"
              value={profileData.gstNumber}
              onChange={(e) => handleInputChange('gstNumber', formatGST(e.target.value))}
              placeholder="22AAAAA0000A1Z5"
              disabled={!isEditing}
              maxLength={15}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.gstNumber 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-purple-400'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {errors.gstNumber && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.gstNumber}</p>
            )}
          </div>
        </form>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-6 sm:mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={handleCancel}
              className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <X className="h-4 w-4" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                hasChanges 
                  ? 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-400' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
              }`}
            >
              <Save className="h-4 w-4" />
              <span>Save Changes</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  const renderMyProjectsContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Projects Header */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">My Projects</h2>
            <p className="text-sm sm:text-base text-gray-300">
              Manage and track your projects with freelancers
            </p>
          </div>
        </div>

        {/* Projects List - This will be populated with real data */}
        <div className="text-center py-12">
          <div className="flex flex-col items-center space-y-4">
            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center">
              <Briefcase className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg sm:text-xl font-semibold text-white">
                No Projects Yet
              </h3>
              <p className="text-sm sm:text-base text-gray-400 max-w-md">
                Use the "Create Project" tab to start your first project with our AI assistant.
              </p>
            </div>
            <button
              onClick={() => setActiveTab('create-project')}
              className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <Plus className="h-4 w-4" />
              <span>Create Your First Project</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  const renderCreateProjectContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-md w-full border border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-purple-400">
                Start New Project
              </h3>
              <button
                onClick={() => setShowNewProjectModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-gray-300 text-sm font-medium mb-2">
                  Project Name *
                </label>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="e.g., Marketing Video for Q1 Campaign"
                  className="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500"
                  autoFocus
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => setShowNewProjectModal(false)}
                  className="flex-1 px-4 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                >
                  Cancel
                </button>
                <button
                  onClick={startNewProject}
                  disabled={!newProjectName.trim()}
                  className={`flex-1 px-4 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
                    newProjectName.trim()
                      ? 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-500'
                      : 'bg-gray-600 cursor-not-allowed text-gray-300 focus:ring-gray-400'
                  }`}
                >
                  Start Project
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-2xl p-8 max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-purple-500/30">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-purple-400">
                Select Project
              </h3>
              <button
                onClick={() => setShowProjectSelector(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-3">
              {savedProjects.length === 0 ? (
                <div className="text-center py-8">
                  <FolderPlus className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-400">No saved projects yet</p>
                </div>
              ) : (
                savedProjects.map((project) => (
                  <div
                    key={project.id}
                    className="flex items-center justify-between p-4 bg-gray-700 rounded-lg hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex-1">
                      <h4 className="font-medium text-white">{project.project_name}</h4>
                      <div className="flex items-center space-x-4 text-sm text-gray-400 mt-1">
                        <span>{project.parameters_collected}/14 parameters</span>
                        <span>Updated {new Date(project.updated_at).toLocaleDateString()}</span>
                        <span className={`px-2 py-1 rounded text-xs ${
                          project.status === 'active' ? 'bg-green-900/20 text-green-400' :
                          project.status === 'completed' ? 'bg-blue-900/20 text-blue-400' :
                          'bg-gray-900/20 text-gray-400'
                        }`}>
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => loadProject(project.project_id)}
                        className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteProject(project.project_id)}
                        className="px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Show Checklist if Generated */}
      {showChecklist && extractedParameters.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
          {/* Confirmation Banner */}
          <ConfirmationBanner
            isLocked={isAgreementLocked}
            timestamp={agreementTimestamp}
            projectId={projectId || undefined}
            onDownload={handleDownloadAgreement}
          />

          {!isAgreementLocked && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Project Agreement</h2>
                <p className="text-sm sm:text-base text-gray-300">
                  Review parameters and obtain digital signatures to finalize
                </p>
              </div>
              <button
                onClick={() => setShowChecklist(false)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Back to Chat</span>
              </button>
            </div>
          )}

          {/* Checklist Display */}
          <div className="mb-8">
            <ChecklistDisplay parameters={extractedParameters} />
          </div>

          {/* Digital Agreement Section */}
          {!isAgreementLocked && (
            <div className="space-y-6">
              <div className="border-t border-gray-600 pt-6">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center space-x-2">
                  <FileText className="h-5 w-5" />
                  <span>Digital Agreement</span>
                </h3>
                <p className="text-gray-300 text-sm mb-6">
                  Both parties must digitally sign this agreement to proceed with the project.
                </p>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                  <SignatureBox
                    title="Client Signature"
                    placeholder="Enter your full name"
                    signature={clientSignature}
                    onSignatureChange={setClientSignature}
                  />
                  <SignatureBox
                    title="Freelancer Signature"
                    placeholder="Freelancer's full name"
                    signature={freelancerSignature}
                    onSignatureChange={setFreelancerSignature}
                    disabled={true}
                  />
                </div>

                <div className="text-center">
                  <button
                    onClick={handleConfirmAgreement}
                    disabled={!clientSignature.timestamp || !freelancerSignature.timestamp}
                    className={`px-8 py-3 rounded-lg font-semibold transition-colors focus:outline-none focus:ring-2 ${
                      clientSignature.timestamp && freelancerSignature.timestamp
                        ? 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-500'
                        : 'bg-gray-600 cursor-not-allowed text-gray-300 focus:ring-gray-400'
                    }`}
                  >
                    Confirm & Lock Checklist
                  </button>
                  <p className="text-gray-400 text-xs mt-2">
                    Note: Freelancer signature will be obtained when they accept the project
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Project Creation Header */}
      {!showChecklist && (
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 space-y-4 sm:space-y-0">
            <div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
                {currentProjectName || 'Create New Project'}
              </h2>
              <p className="text-sm sm:text-base text-gray-300">
                {currentProjectId 
                  ? 'Continue chatting with our AI assistant to refine your project checklist'
                  : 'Chat with our AI assistant to create a detailed project checklist'
                }
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowProjectSelector(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <History className="h-4 w-4" />
                <span>Load Project</span>
              </button>
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
              >
                <FolderPlus className="h-4 w-4" />
                <span>New Project</span>
              </button>
            </div>
          </div>

          {/* Show progress only if we have a current project */}
          {currentProjectId && (
            <div className="flex items-center space-x-2 text-sm text-purple-400 mb-6">
              <CheckCircle className="h-4 w-4" />
              <span>{collectedParameters}/14 parameters collected</span>
            </div>
          )}

          {/* Show message if no current project */}
          {!currentProjectId && (
            <div className="text-center py-12">
              <div className="flex flex-col items-center space-y-4">
                <div className="w-16 h-16 bg-gray-700 rounded-full flex items-center justify-center">
                  <FolderPlus className="h-8 w-8 text-gray-400" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-white">
                    No Active Project
                  </h3>
                  <p className="text-gray-400 max-w-md">
                    Start a new project or load an existing one to continue working with the AI assistant.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={() => setShowNewProjectModal(true)}
                    className="flex items-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    <FolderPlus className="h-4 w-4" />
                    <span>Start New Project</span>
                  </button>
                  {savedProjects.length > 0 && (
                    <button
                      onClick={() => setShowProjectSelector(true)}
                      className="flex items-center space-x-2 px-6 py-3 bg-gray-600 hover:bg-gray-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
                    >
                      <History className="h-4 w-4" />
                      <span>Load Project</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

        {/* Progress Bar */}
        {currentProjectId && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-300">Project Definition Progress</span>
              <span className="text-sm text-purple-400">{Math.round((collectedParameters / 14) * 100)}%</span>
            </div>
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-purple-500 to-pink-500 h-2 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((collectedParameters / 14) * 100, 100)}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Chat Interface - only show if we have a current project */}
        {currentProjectId && (
          <div className="bg-gray-900 rounded-xl border border-gray-600 overflow-hidden">
          {/* Chat Header */}
          <div className="bg-gray-700 px-4 py-3 border-b border-gray-600">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
                <Bot className="h-4 w-4 text-white" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">AI Project Assistant</h3>
                <p className="text-xs text-gray-400">Online • Working on: {currentProjectName}</p>
              </div>
            </div>
          </div>

          {/* Chat Messages */}
          <div className="h-96 overflow-y-auto p-4 space-y-4">
            {conversation.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                    message.role === 'user'
                      ? 'bg-purple-600 text-white rounded-br-sm'
                      : 'bg-gray-700 text-gray-100 rounded-bl-sm'
                  }`}
                >
                  <p className="text-sm leading-relaxed">{message.content}</p>
                  <p className={`text-xs mt-1 ${
                    message.role === 'user' ? 'text-purple-200' : 'text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-700 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-xs">
                  <div className="flex items-center space-x-2">
                    <div className="flex space-x-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
                    </div>
                    <span className="text-xs text-gray-400">AI is typing...</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="px-4 py-2 bg-red-900/20 border-t border-red-500/30">
              <div className="flex items-center space-x-2 text-red-400 text-sm">
                <AlertCircle className="h-4 w-4" />
                <span>{error}</span>
              </div>
            </div>
          )}

          {/* Message Input */}
          <div className="border-t border-gray-600 p-4">
            <div className="flex space-x-3">
              <input
                type="text"
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Type your message..."
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-700 border border-gray-600 rounded-full text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
              />
              <button
                onClick={handleSendMessage}
                disabled={!currentMessage.trim() || isLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        )}

        {/* Generate Checklist Button */}
        {currentProjectId && collectedParameters >= 14 && (
          <div className="mt-6 p-4 bg-green-900/20 border border-green-500/30 rounded-xl">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-green-400 mb-1">Ready to Generate Checklist!</h3>
                <p className="text-sm text-green-300">
                  We've collected enough information to create your detailed project checklist.
                </p>
              </div>
              <button
                onClick={generateFinalChecklist}
                disabled={isGeneratingChecklist}
                className={`px-6 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 flex items-center space-x-2 ${
                  isGeneratingChecklist 
                    ? 'bg-gray-600 cursor-not-allowed text-gray-300' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isGeneratingChecklist ? (
                  <>
                    <div className="w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin"></div>
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4" />
                    <span>Generate Project Agreement</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
        </div>
      )}
    </div>
  );

  const renderTransactionsContent = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="text-center py-12">
          <CreditCard className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Transactions Yet</h3>
          <p className="text-gray-400">Your transaction history will appear here</p>
        </div>
      </div>
    </div>
  );

  const renderMessagesContent = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="text-center py-12">
          <MessageSquare className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">No Messages Yet</h3>
          <p className="text-gray-400">Your conversations with freelancers will appear here</p>
        </div>
      </div>
    </div>
  );

  const renderTabContent = () => {
    switch (activeTab) {
      case 'profile':
        return renderProfileContent();
      case 'projects':
        return renderMyProjectsContent();
      case 'create-project':
        return renderCreateProjectContent();
      case 'transactions':
        return renderTransactionsContent();
      case 'messages':
        return renderMessagesContent();
      default:
        return renderProfileContent();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16">
            <Link to="/" className="flex items-center space-x-2">
              <Shield className="h-8 w-8 text-purple-400" />
              <span className="text-xl font-bold text-white">SecureServe</span>
            </Link>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-gray-300 text-sm sm:text-base hidden sm:inline">
                Welcome, {profileData.fullName || 'Client'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Tab Navigation */}
        <nav className="mb-6 sm:mb-8">
          <div className="border-b border-gray-700">
            <div className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors ${
                      activeTab === tab.id
                        ? 'border-purple-400 text-purple-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                  >
                    <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        {renderTabContent()}
      </main>
    </div>
  );
};

export default ClientDashboard;
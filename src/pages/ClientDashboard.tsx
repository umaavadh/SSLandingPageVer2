import React, { useState, useEffect } from 'react';
import { User, Briefcase, CreditCard, MessageSquare, Shield, Edit3, Save, X, Plus, Minus, Wand2, Loader, CheckCircle, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut } from '../lib/supabase';
import { generateChecklist, ChecklistItem, ConversationMessage } from '../lib/edgeFunctions';
import AddProjectForm from '../components/AddProjectForm';

interface ProfileData {
  fullName: string;
  email: string;
  mobileNumber: string;
  countryCode: string;
  companyName: string;
  gstNumber: string;
  clientId: string;
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

  // Project creation state
  const [projectDescription, setProjectDescription] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedChecklist, setGeneratedChecklist] = useState<ChecklistItem[]>([]);
  const [conversationError, setConversationError] = useState('');
  
  // Conversation state
  const [conversationHistory, setConversationHistory] = useState<ConversationMessage[]>([]);
  const [currentResponse, setCurrentResponse] = useState('');
  const [followUpQuestions, setFollowUpQuestions] = useState<string[]>([]);
  const [isConversationMode, setIsConversationMode] = useState(false);
  const [conversationComplete, setConversationComplete] = useState(false);
  const [consultationId, setConsultationId] = useState<string>('');
  
  // Project creation form state
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [projectFormData, setProjectFormData] = useState({
    projectName: '',
    freelancerId: '',
    completionDate: '',
    projectAmount: ''
  });
  const [projectFormErrors, setProjectFormErrors] = useState({
    projectName: '',
    freelancerId: '',
    completionDate: ''
  });

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
    { id: 'create-project', label: 'Create Project', icon: Plus },
    { id: 'projects', label: 'My Projects', icon: Briefcase },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'messages', label: 'Messages', icon: MessageSquare }
  ];

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { user } = await getCurrentUser()
        if (user) {
          // Load user profile from database
          const { getUserProfile } = await import('../lib/supabase')
          const { data: profile, error } = await getUserProfile()
          
          if (error) {
            console.error('Error loading profile:', error)
            // Set basic data from auth user
            setProfileData(prev => ({ ...prev, email: user.email || '' }))
            setOriginalData(prev => ({ ...prev, email: user.email || '' }))
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
            }
            setProfileData(profileData)
            setOriginalData(profileData)
            setIsNewUser(!profile.profile_completed)
            if (profile.updated_at) {
              setLastUpdated(new Date(profile.updated_at))
            }
          } else {
            // No profile exists, set basic data
            setProfileData(prev => ({ ...prev, email: user.email || '' }))
            setOriginalData(prev => ({ ...prev, email: user.email || '' }))
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error)
      }
    }

    loadUserData()
  }, [])

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
        const { updateUserProfile } = await import('../lib/supabase')
        
        const profileUpdateData = {
          user_type: 'client',
          full_name: profileData.fullName,
          mobile_number: profileData.mobileNumber,
          country_code: profileData.countryCode,
          company_name: profileData.companyName,
          gst_number: profileData.gstNumber,
          profile_completed: true
        }
        
        const { data, error } = await updateUserProfile(profileUpdateData)
        
        if (error) {
          console.error('Error saving profile:', error)
          // Handle error - you might want to show a toast notification
          return
        }
        
        if (data) {
          // Update local state with saved data
          const updatedProfileData = {
            ...profileData,
            clientId: data.client_id || profileData.clientId
          }
          setProfileData(updatedProfileData)
          setOriginalData(updatedProfileData)
          setHasChanges(false)
          setIsEditing(false)
          setLastUpdated(new Date())
          setIsNewUser(false)
        }
      } catch (error) {
        console.error('Error saving profile:', error)
      }
    }
  }

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

  // Handle checklist generation
  const handleStartConversation = async () => {
    if (!projectDescription.trim()) {
      setConversationError('Please enter a project description first');
      return;
    }

    if (projectDescription.trim().length < 50) {
      setConversationError('Project description must be at least 50 characters long');
      return;
    }

    setIsGenerating(true);
    setConversationError('');
    setIsConversationMode(true);

    try {
      const result = await generateChecklist(projectDescription, conversationHistory);

      if (result.success) {
        if (result.isComplete && result.checklist) {
          // Conversation complete, show final checklist
          setGeneratedChecklist(result.checklist);
          setConversationComplete(true);
          setIsConversationMode(false);
          
          // Save consultation with final checklist
          await saveConsultationWithChecklist(result);
        } else {
          // Continue conversation
          setCurrentResponse(result.response || '');
          setFollowUpQuestions(result.followUpQuestions || []);
          setConversationHistory(result.conversationHistory || []);
          
          // Save consultation progress
          await saveConsultationProgress(projectDescription, result.conversationHistory || []);
        }
        setConversationError('');
      } else {
        setConversationError(result.error || 'Failed to start conversation');
        setIsConversationMode(false);
      }
    } catch (error) {
      console.error('Error starting conversation:', error);
      setConversationError('An unexpected error occurred while starting the conversation');
      setIsConversationMode(false);
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle conversation continuation
  const handleContinueConversation = async (response: string) => {
    if (!response.trim()) {
      setConversationError('Please provide a response');
      return;
    }

    setIsGenerating(true);
    setConversationError('');

    try {
      const result = await generateChecklist(response, conversationHistory);

      if (result.success) {
        if (result.isComplete && result.checklist) {
          // Conversation complete, show final checklist
          setGeneratedChecklist(result.checklist);
          setConversationComplete(true);
          setIsConversationMode(false);
          
          // Save consultation with final checklist
          await saveConsultationWithChecklist(result);
        } else {
          // Continue conversation
          setCurrentResponse(result.response || '');
          setFollowUpQuestions(result.followUpQuestions || []);
          setConversationHistory(result.conversationHistory || []);
          
          // Save consultation progress
          await saveConsultationProgress(response, result.conversationHistory || []);
        }
        setConversationError('');
      } else {
        setConversationError(result.error || 'Failed to continue conversation');
      }
    } catch (error) {
      console.error('Error continuing conversation:', error);
      setConversationError('An unexpected error occurred while continuing the conversation');
    } finally {
      setIsGenerating(false);
    }
  };

  // Handle generating final checklist
  const handleGenerateFinalChecklist = async () => {
    setIsGenerating(true);
    setConversationError('');

    try {
      const result = await generateChecklist(
        'Please generate the final checklist based on our conversation',
        conversationHistory,
        true // Force final generation
      );

      if (result.success && result.checklist) {
        setGeneratedChecklist(result.checklist);
        setConversationComplete(true);
        setIsConversationMode(false);
        
        // Save consultation with final checklist
        await saveConsultationWithChecklist(result);
      } else {
        setConversationError(result.error || 'Failed to generate final checklist');
      }
    } catch (error) {
      console.error('Error generating final checklist:', error);
      setConversationError('An unexpected error occurred while generating the final checklist');
    } finally {
      setIsGenerating(false);
    }
  };

  // Reset conversation
  const handleResetConversation = () => {
    setProjectDescription('');
    setConversationHistory([]);
    setCurrentResponse('');
    setFollowUpQuestions([]);
    setIsConversationMode(false);
    setConversationComplete(false);
    setGeneratedChecklist([]);
    setConversationError('');
    setConsultationId('');
    setShowProjectForm(false);
    setProjectFormData({
      projectName: '',
      freelancerId: '',
      completionDate: '',
      projectAmount: ''
    });
    setProjectFormErrors({
      projectName: '',
      freelancerId: '',
      completionDate: ''
    });
  };

  // Save consultation progress to database
  const saveConsultationProgress = async (description: string, history: ConversationMessage[]) => {
    try {
      const { saveConsultationProgress } = await import('../lib/supabase');
      await saveConsultationProgress(description, history);
    } catch (error) {
      console.error('Error saving consultation progress:', error);
    }
  };

  // Save consultation with final checklist
  const saveConsultationWithChecklist = async (result: any) => {
    try {
      const { saveConsultationProgress } = await import('../lib/supabase');
      const { data } = await saveConsultationProgress(
        projectDescription,
        result.conversationHistory || [],
        result,
        true
      );
      
      if (data?.consultation_id) {
        setConsultationId(data.consultation_id);
        setShowProjectForm(true);
      }
    } catch (error) {
      console.error('Error saving consultation with checklist:', error);
      setConversationError('Failed to save consultation data');
    }
  };

  // Get tomorrow's date in YYYY-MM-DD format
  const getTomorrowDate = () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().split('T')[0];
  };

  // Validate project form
  const validateProjectForm = () => {
    const newErrors = {
      projectName: '',
      freelancerId: '',
      completionDate: ''
    };

    if (!projectFormData.projectName.trim()) {
      newErrors.projectName = 'Project name is required';
    }

    if (projectFormData.freelancerId && !/^F\d{9}$/.test(projectFormData.freelancerId)) {
      newErrors.freelancerId = 'Freelancer ID must be in format F123456789';
    }

    if (!projectFormData.completionDate) {
      newErrors.completionDate = 'Completion date is required';
    } else {
      const selectedDate = new Date(projectFormData.completionDate);
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      if (selectedDate < tomorrow) {
        newErrors.completionDate = 'Completion date must be at least tomorrow';
      }
    }

    setProjectFormErrors(newErrors);
    return !Object.values(newErrors).some(error => error !== '');
  };

  // Handle project creation from consultation
  const handleCreateProjectFromConsultation = async () => {
    if (!validateProjectForm()) {
      return;
    }

    try {
      const { createProjectFromConsultation } = await import('../lib/supabase');
      
      const { data, error } = await createProjectFromConsultation(
        consultationId,
        projectFormData.projectName,
        projectFormData.freelancerId || undefined,
        projectFormData.completionDate,
        projectFormData.projectAmount ? parseFloat(projectFormData.projectAmount) : undefined
      );
      
      if (error) {
        console.error('Error creating project:', error);
        setConversationError('Failed to create project. Please try again.');
        return;
      }
      
      if (data) {
        // Reset form and switch to projects tab
        handleResetConversation();
        setActiveTab('projects');
        
        // Clear any errors
        setConversationError('');
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setConversationError('An unexpected error occurred while creating the project');
    }
  };

  // Handle project form input changes
  const handleProjectFormChange = (field: string, value: string) => {
    setProjectFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear error when user starts typing
    if (projectFormErrors[field as keyof typeof projectFormErrors]) {
      setProjectFormErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Format Freelancer ID input
  const handleFreelancerIdChange = (value: string) => {
    // Remove any non-digit characters except F at the beginning
    let formatted = value.replace(/[^F\d]/g, '');
    
    // Ensure it starts with F
    if (!formatted.startsWith('F') && formatted.length > 0) {
      formatted = 'F' + formatted.replace(/F/g, '');
    }
    
    // Limit to F + 9 digits
    if (formatted.length > 10) {
      formatted = formatted.substring(0, 10);
    }
    
    handleProjectFormChange('freelancerId', formatted);
  };

  // Get priority color
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'text-red-400 bg-red-900/20 border-red-500/30';
      case 'medium': return 'text-yellow-400 bg-yellow-900/20 border-yellow-500/30';
      case 'low': return 'text-green-400 bg-green-900/20 border-green-500/30';
      default: return 'text-gray-400 bg-gray-900/20 border-gray-500/30';
    }
  };

  // Get category color
  const getCategoryColor = (category: string) => {
    switch (category.toLowerCase()) {
      case 'technical': return 'text-blue-400 bg-blue-900/20';
      case 'creative': return 'text-purple-400 bg-purple-900/20';
      case 'content': return 'text-green-400 bg-green-900/20';
      case 'delivery': return 'text-cyan-400 bg-cyan-900/20';
      case 'quality': return 'text-pink-400 bg-pink-900/20';
      default: return 'text-gray-400 bg-gray-900/20';
    }
  };

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

  const renderCreateProjectContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Project Description Form */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">
            {isConversationMode ? 'Video Project Consultation' : 'Create New Video Project'}
          </h2>
          <p className="text-sm sm:text-base text-gray-300">
            {isConversationMode 
              ? 'Our AI consultant will ask follow-up questions to create the perfect checklist for your project.'
              : 'Describe your video project requirements and our AI consultant will help you create a detailed checklist.'
            }
          </p>
        </div>

        <div className="space-y-6">
          {!isConversationMode ? (
            /* Initial Project Description */
            <div>
              <label htmlFor="project-description" className="block text-gray-300 text-sm font-semibold mb-2">
                Project Description *
              </label>
              <textarea
                id="project-description"
                rows={6}
                value={projectDescription}
                onChange={(e) => setProjectDescription(e.target.value)}
                placeholder="Describe your video project in detail. Include the purpose, target audience, style preferences, duration, specific elements needed, and any other requirements..."
                className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base resize-none"
                disabled={isGenerating}
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-gray-400 text-xs sm:text-sm">
                  Minimum 50 characters required to start consultation
                </p>
                <span className={`text-xs sm:text-sm ${
                  projectDescription.length >= 50 ? 'text-green-400' : 'text-gray-400'
                }`}>
                  {projectDescription.length}/50
                </span>
              </div>
            </div>
          ) : (
            /* Conversation Interface */
            <ConversationInterface 
              currentResponse={currentResponse}
              followUpQuestions={followUpQuestions}
              conversationHistory={conversationHistory}
              onContinueConversation={handleContinueConversation}
              onGenerateFinalChecklist={handleGenerateFinalChecklist}
              isGenerating={isGenerating}
            />
          )}

          {/* Error Display */}
          {conversationError && (
            <div className="p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <p className="text-red-400 text-sm flex items-center">
                <AlertCircle className="h-4 w-4 mr-2" />
                {conversationError}
              </p>
            </div>
          )}

          {/* Action Buttons */}
          {!isConversationMode && (
            <div className="pt-4 border-t border-gray-700">
              <button
                onClick={handleStartConversation}
                disabled={isGenerating || projectDescription.trim().length < 50}
                className={`w-full flex items-center justify-center space-x-2 py-3 sm:py-4 rounded-lg font-semibold text-base sm:text-lg transition-colors focus:outline-none focus:ring-2 ${
                  isGenerating || projectDescription.trim().length < 50
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
                    : 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-400'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
                    <span>Starting Consultation...</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6" />
                    <span>Start AI Consultation</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Generated Checklist Display */}
      {conversationComplete && generatedChecklist.length > 0 && !showProjectForm && (
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
          <div className="mb-6 sm:mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              AI-Generated Project Checklist
            </h3>
            <p className="text-sm sm:text-base text-gray-300">
              Review this checklist and proceed to create your project. Each item will be verified by our AI system.
            </p>
          </div>

          {/* Checklist Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-purple-400">{generatedChecklist.length}</div>
              <div className="text-sm text-gray-300">Total Items</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-green-400">
                {generatedChecklist.filter(item => item.verifiable).length}
              </div>
              <div className="text-sm text-gray-300">AI Verifiable</div>
            </div>
            <div className="bg-gray-700 rounded-lg p-4 text-center">
              <div className="text-2xl font-bold text-red-400">
                {generatedChecklist.filter(item => item.priority === 'high').length}
              </div>
              <div className="text-sm text-gray-300">High Priority</div>
            </div>
          </div>

          {/* Checklist Items */}
          <div className="space-y-4">
            {generatedChecklist.map((item, index) => (
              <div
                key={item.id}
                className="bg-gray-700 rounded-lg p-4 border border-gray-600 hover:border-gray-500 transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <h4 className="text-white font-semibold">{item.requirement}</h4>
                      <div className="flex items-center space-x-2 mt-1">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(item.category)}`}>
                          {item.category}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(item.priority)}`}>
                          {item.priority.toUpperCase()}
                        </span>
                        {item.verifiable && (
                          <span className="px-2 py-1 rounded-full text-xs font-medium text-green-400 bg-green-900/20 border border-green-500/30">
                            AI VERIFIABLE
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <p className="text-gray-300 text-sm leading-relaxed ml-11">
                  {item.description}
                </p>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-6 sm:mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={() => {
                handleResetConversation();
              }}
              className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
            >
              <X className="h-4 w-4" />
              <span>Start Over</span>
            </button>
            <button
              onClick={() => setShowProjectForm(true)}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <CheckCircle className="h-4 w-4" />
              <span>Proceed to Create Project</span>
            </button>
          </div>
        </div>
      )}

      {/* Project Creation Form */}
      {showProjectForm && generatedChecklist.length > 0 && (
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
          <div className="mb-6 sm:mb-8">
            <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Create Your Project
            </h3>
            <p className="text-sm sm:text-base text-gray-300">
              Fill in the project details to create your project with the AI-generated checklist.
            </p>
          </div>

          <form className="space-y-6" onSubmit={(e) => { e.preventDefault(); handleCreateProjectFromConsultation(); }}>
            {/* Project Name */}
            <div>
              <label htmlFor="project-name" className="block text-gray-300 text-sm font-semibold mb-2">
                Project Name *
              </label>
              <input
                id="project-name"
                type="text"
                value={projectFormData.projectName}
                onChange={(e) => handleProjectFormChange('projectName', e.target.value)}
                placeholder="Enter your project name"
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  projectFormErrors.projectName 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-purple-400'
                }`}
              />
              {projectFormErrors.projectName && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{projectFormErrors.projectName}</p>
              )}
            </div>

            {/* Freelancer ID (Optional) */}
            <div>
              <label htmlFor="freelancer-id" className="block text-gray-300 text-sm font-semibold mb-2">
                Freelancer ID (Optional)
              </label>
              <input
                id="freelancer-id"
                type="text"
                value={projectFormData.freelancerId}
                onChange={(e) => handleFreelancerIdChange(e.target.value)}
                placeholder="F123456789"
                maxLength={10}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  projectFormErrors.freelancerId 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-purple-400'
                }`}
              />
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                Leave empty to assign freelancer later
              </p>
              {projectFormErrors.freelancerId && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{projectFormErrors.freelancerId}</p>
              )}
            </div>

            {/* Completion Date */}
            <div>
              <label htmlFor="completion-date" className="block text-gray-300 text-sm font-semibold mb-2">
                Desired Completion Date *
              </label>
              <input
                id="completion-date"
                type="date"
                value={projectFormData.completionDate}
                onChange={(e) => handleProjectFormChange('completionDate', e.target.value)}
                min={getTomorrowDate()}
                className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white text-sm sm:text-base ${
                  projectFormErrors.completionDate 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-purple-400'
                }`}
              />
              {projectFormErrors.completionDate && (
                <p className="text-red-400 text-xs sm:text-sm mt-1">{projectFormErrors.completionDate}</p>
              )}
            </div>

            {/* Project Amount (Optional) */}
            <div>
              <label htmlFor="project-amount" className="block text-gray-300 text-sm font-semibold mb-2">
                Project Budget (Optional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400">₹</span>
                <input
                  id="project-amount"
                  type="number"
                  value={projectFormData.projectAmount}
                  onChange={(e) => handleProjectFormChange('projectAmount', e.target.value)}
                  placeholder="0"
                  min="0"
                  step="100"
                  className="w-full pl-8 pr-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-purple-400 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base"
                />
              </div>
              <p className="text-gray-400 text-xs sm:text-sm mt-1">
                Leave empty to negotiate with freelancer
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 pt-6 border-t border-gray-700">
              <button
                type="button"
                onClick={() => setShowProjectForm(false)}
                className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              >
                <X className="h-4 w-4" />
                <span>Back to Checklist</span>
              </button>
              <button
                type="submit"
                disabled={isGenerating}
                className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                  isGenerating
                    ? 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
                    : 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-400'
                }`}
              >
                {isGenerating ? (
                  <>
                    <Loader className="h-4 w-4 animate-spin" />
                    <span>Creating Project...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    <span>Create Project</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
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
          <button
            onClick={() => setActiveTab('create-project')}
            className="flex items-center space-x-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 w-full sm:w-auto justify-center"
          >
            <Plus className="h-4 w-4" />
            <span>Create Project</span>
          </button>
        </div>

        {/* Project Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">0</div>
            <div className="text-sm text-gray-300">Total Projects</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">0</div>
            <div className="text-sm text-gray-300">Active Projects</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">0</div>
            <div className="text-sm text-gray-300">Completed</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-yellow-400">₹0</div>
            <div className="text-sm text-gray-300">Total Spent</div>
          </div>
        </div>

        {/* Projects Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Project Name</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Status</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Freelancer</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Due Date</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Amount</th>
                <th className="text-left py-3 px-4 text-gray-300 font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {/* Empty state */}
              <tr>
                <td colSpan={6} className="text-center py-12">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center">
                      <Briefcase className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
                    </div>
                    <div className="space-y-2">
                      <h3 className="text-lg sm:text-xl font-semibold text-white">
                        No Projects Yet
                      </h3>
                      <p className="text-sm sm:text-base text-gray-400 max-w-md">
                        Create your first project to start working with freelancers. 
                        Our AI will help you define clear requirements and manage deliverables.
                      </p>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Status Legend */}
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Project Status:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-500 rounded-full"></div>
              <span className="text-gray-300">Draft</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-300">Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-300">Completed</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <span className="text-gray-300">Cancelled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )

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
      case 'create-project':
        return renderCreateProjectContent();
      case 'projects':
        return renderMyProjectsContent();
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

// Conversation Interface Component
interface ConversationInterfaceProps {
  currentResponse: string;
  followUpQuestions: string[];
  conversationHistory: ConversationMessage[];
  onContinueConversation: (response: string) => void;
  onGenerateFinalChecklist: () => void;
  isGenerating: boolean;
}

const ConversationInterface: React.FC<ConversationInterfaceProps> = ({
  currentResponse,
  followUpQuestions,
  conversationHistory,
  onContinueConversation,
  onGenerateFinalChecklist,
  isGenerating
}) => {
  const [userResponse, setUserResponse] = useState('');

  const handleSubmitResponse = () => {
    if (userResponse.trim()) {
      onContinueConversation(userResponse.trim());
      setUserResponse('');
    }
  };

  const handleQuestionClick = (question: string) => {
    setUserResponse(question);
  };

  return (
    <div className="space-y-6">
      {/* Conversation History */}
      {conversationHistory.length > 0 && (
        <div className="bg-gray-700 rounded-lg p-4 max-h-64 overflow-y-auto">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Conversation History:</h4>
          <div className="space-y-3">
            {conversationHistory.slice(-4).map((message, index) => (
              <div key={index} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-3 py-2 rounded-lg text-sm ${
                  message.role === 'user' 
                    ? 'bg-purple-600 text-white' 
                    : 'bg-gray-600 text-gray-200'
                }`}>
                  {message.content}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Current AI Response */}
      {currentResponse && (
        <div className="bg-gray-700 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center">
              <MessageSquare className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-white text-sm sm:text-base leading-relaxed">
                {currentResponse}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Follow-up Questions */}
      {followUpQuestions.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-300">Suggested responses:</h4>
          <div className="grid gap-2">
            {followUpQuestions.map((question, index) => (
              <button
                key={index}
                onClick={() => handleQuestionClick(question)}
                disabled={isGenerating}
                className="text-left p-3 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm text-gray-300 hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {question}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* User Response Input */}
      <div className="space-y-3">
        <label className="block text-gray-300 text-sm font-semibold">
          Your Response:
        </label>
        <textarea
          rows={3}
          value={userResponse}
          onChange={(e) => setUserResponse(e.target.value)}
          placeholder="Type your response here..."
          disabled={isGenerating}
          className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-purple-400 focus:ring-2 focus:ring-purple-400/50 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base resize-none disabled:opacity-50"
        />
        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleSubmitResponse}
            disabled={isGenerating || !userResponse.trim()}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
              isGenerating || !userResponse.trim()
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
                : 'bg-purple-600 hover:bg-purple-700 text-white focus:ring-purple-400'
            }`}
          >
            {isGenerating ? (
              <>
                <Loader className="h-4 w-4 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <>
                <MessageSquare className="h-4 w-4" />
                <span>Continue Conversation</span>
              </>
            )}
          </button>
          <button
            onClick={onGenerateFinalChecklist}
            disabled={isGenerating || conversationHistory.length < 2}
            className={`flex-1 flex items-center justify-center space-x-2 py-3 rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 ${
              isGenerating || conversationHistory.length < 2
                ? 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
                : 'bg-green-600 hover:bg-green-700 text-white focus:ring-green-400'
            }`}
          >
            <CheckCircle className="h-4 w-4" />
            <span>Generate Final Checklist</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ClientDashboard;
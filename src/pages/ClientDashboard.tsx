import React, { useState, useEffect } from 'react';
import { User, Building, CreditCard, MessageSquare, Shield, Edit3, Save, X, Upload, Plus, Clock, FileText, CheckCircle, Trash2, Eye, Calendar, DollarSign } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut, getUserProfile, updateUserProfile, getProjectConversations, saveProjectConversation, deleteProjectConversation } from '../lib/supabase';

interface ProfileData {
  fullName: string;
  email: string;
  mobileNumber: string;
  countryCode: string;
  companyName: string;
  panNumber: string;
  upiId: string;
  clientId: string;
}

interface ProjectData {
  projectId: string;
  projectCategory: string;
  projectName: string;
  freelancerId: string;
  projectRequirement: string;
  desiredCompletionDate: string;
  projectFiles: File[];
}

interface Deliverable {
  id: number;
  description: string;
}

const ClientDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('profile');
  const [isNewUser, setIsNewUser] = useState(true);
  const [hasChanges, setHasChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [showDeliverablesView, setShowDeliverablesView] = useState(false);
  const [deliverables, setDeliverables] = useState<Deliverable[]>([
    { id: 1, description: 'Deliverable 1 (e.g., High-quality 1080p video in MP4 format)' },
    { id: 2, description: 'Deliverable 2 (e.g., High-quality 1080p video in MP4 format)' },
    { id: 3, description: 'Deliverable 3 (e.g., High-quality 1080p video in MP4 format)' },
    { id: 4, description: 'Deliverable 4 (e.g., High-quality 1080p video in MP4 format)' }
  ]);

  const [profileData, setProfileData] = useState<ProfileData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    companyName: '',
    panNumber: '',
    upiId: '',
    clientId: ''
  });

  const [projectData, setProjectData] = useState<ProjectData>({
    projectId: '',
    projectCategory: 'Video Production',
    projectName: '',
    freelancerId: '',
    projectRequirement: '',
    desiredCompletionDate: '',
    projectFiles: []
  });

  const [originalData, setOriginalData] = useState<ProfileData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    companyName: '',
    panNumber: '',
    upiId: '',
    clientId: ''
  });

  const [errors, setErrors] = useState<Partial<ProfileData>>({});

  const countryCodes = [
    { code: '+91', country: 'India', flag: '🇮🇳' },
    { code: '+1', country: 'USA', flag: '🇺🇸' },
    { code: '+44', country: 'UK', flag: '🇬🇧' }
  ];

  const tabs = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'create-project', label: 'Create Project', icon: Plus },
    { id: 'my-projects', label: 'My Projects', icon: Building },
    { id: 'transactions', label: 'Transactions', icon: CreditCard },
    { id: 'chat', label: 'Chat', icon: MessageSquare }
  ];

  // Load user data on component mount
  useEffect(() => {
    const loadUserData = async () => {
      try {
        const { user } = await getCurrentUser();
        if (user) {
          const { data: profile, error } = await getUserProfile();
          
          if (error) {
            console.error('Error loading profile:', error);
            setProfileData(prev => ({ ...prev, email: user.email || '' }));
            setOriginalData(prev => ({ ...prev, email: user.email || '' }));
          } else if (profile) {
            const profileData = {
              fullName: profile.full_name || '',
              email: user.email || '',
              mobileNumber: profile.mobile_number || '',
              countryCode: profile.country_code || '+91',
              companyName: profile.company_name || '',
              panNumber: profile.gst_number || '',
              upiId: profile.upi_id || '',
              clientId: profile.client_id || ''
            };
            setProfileData(profileData);
            setOriginalData(profileData);
            setIsNewUser(!profile.profile_completed);
            if (profile.updated_at) {
              setLastUpdated(new Date(profile.updated_at));
            }
          } else {
            setProfileData(prev => ({ ...prev, email: user.email || '' }));
            setOriginalData(prev => ({ ...prev, email: user.email || '' }));
          }
        }
      } catch (error) {
        console.error('Error loading user data:', error);
      }
    };

    loadUserData();
  }, []);

  // Calculate profile completion percentage
  const calculateCompletion = () => {
    const fields = ['fullName', 'mobileNumber', 'companyName', 'panNumber', 'upiId'];
    const completed = fields.filter(field => profileData[field as keyof ProfileData].trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  // Handle input changes
  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Handle project input changes
  const handleProjectInputChange = (field: keyof ProjectData, value: string) => {
    setProjectData(prev => ({ ...prev, [field]: value }));
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

    if (!profileData.panNumber.trim()) {
      newErrors.panNumber = 'PAN/TAN number is required';
    }

    if (!profileData.upiId.trim()) {
      newErrors.upiId = 'UPI ID is required';
    } else if (!/^[\w.-]+@[\w.-]+$/.test(profileData.upiId)) {
      newErrors.upiId = 'Please enter a valid UPI ID';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle save changes
  const handleSave = async () => {
    if (validateForm()) {
      try {
        const profileUpdateData = {
          user_type: 'client',
          full_name: profileData.fullName,
          mobile_number: profileData.mobileNumber,
          country_code: profileData.countryCode,
          company_name: profileData.companyName,
          gst_number: profileData.panNumber,
          upi_id: profileData.upiId,
          profile_completed: true
        };
        
        const { data, error } = await updateUserProfile(profileUpdateData);
        
        if (error) {
          console.error('Error saving profile:', error);
          return;
        }
        
        if (data) {
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

  // Handle file upload
  const handleFileUpload = (files: FileList | null) => {
    if (files) {
      const fileArray = Array.from(files);
      setProjectData(prev => ({ ...prev, projectFiles: [...prev.projectFiles, ...fileArray] }));
    }
  };

  // Handle create project
  const handleCreateProject = () => {
    // Generate project ID
    const projectId = 'Will be auto generated';
    setProjectData(prev => ({ ...prev, projectId }));
    setShowCreateProjectModal(false);
    setShowDeliverablesView(true);
  };

  // Add deliverable
  const addDeliverable = () => {
    const newId = Math.max(...deliverables.map(d => d.id)) + 1;
    setDeliverables(prev => [...prev, { 
      id: newId, 
      description: `Deliverable ${newId} (e.g., High-quality 1080p video in MP4 format)` 
    }]);
  };

  // Remove deliverable
  const removeDeliverable = (id: number) => {
    setDeliverables(prev => prev.filter(d => d.id !== id));
  };

  // Update deliverable
  const updateDeliverable = (id: number, description: string) => {
    setDeliverables(prev => prev.map(d => d.id === id ? { ...d, description } : d));
  };

  const renderProfileContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Profile Status Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-2 sm:space-y-0">
        <div className="flex items-center space-x-2">
          <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
          <span className="text-sm sm:text-base text-gray-300">
            Last updated: {lastUpdated ? `${lastUpdated.toLocaleDateString()} at ${lastUpdated.toLocaleTimeString()}` : '7/28/2025 at 7:06:07 PM'}
          </span>
        </div>
        <div className="flex items-center space-x-2">
          <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" />
          <span className="text-sm sm:text-base text-green-400 font-medium">Profile Complete</span>
        </div>
      </div>

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

        <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8" noValidate>
          {/* Client ID */}
          <div className="lg:col-span-2">
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Client ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={profileData.clientId || 'C780292353'}
                disabled
                className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60 text-sm sm:text-base"
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Shield className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Your unique client identification number
            </p>
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
              placeholder="Subham"
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

          {/* Email Address */}
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
            <p className="text-gray-400 text-xs sm:text-sm mt-1">Email cannot be changed</p>
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
                placeholder="9876543210"
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

          {/* Company/Organization Name */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              Company/Organization Name *
            </label>
            <div className="relative">
              <input
                type="text"
                value={profileData.companyName}
                onChange={(e) => handleInputChange('companyName', e.target.value)}
                placeholder="Subham Enterprises"
                disabled={!isEditing}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  errors.companyName 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-purple-400'
                } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Building className="h-5 w-5 text-purple-400" />
              </div>
            </div>
            {errors.companyName && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.companyName}</p>
            )}
          </div>

          {/* PAN/TAN Number */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              PAN/TAN Number *
            </label>
            <input
              type="text"
              value={profileData.panNumber}
              onChange={(e) => handleInputChange('panNumber', e.target.value.toUpperCase())}
              placeholder="ABCDE1234F"
              disabled={!isEditing}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.panNumber 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-purple-400'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              10-character alphanumeric identifier (e.g., ABCDE1234F)
            </p>
            {errors.panNumber && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.panNumber}</p>
            )}
          </div>

          {/* UPI ID */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              UPI ID *
            </label>
            <input
              type="text"
              value={profileData.upiId}
              onChange={(e) => handleInputChange('upiId', e.target.value)}
              placeholder="9876543210@sbi"
              disabled={!isEditing}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.upiId 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-purple-400'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            <p className="text-gray-400 text-xs sm:text-sm mt-1">
              Example: yourname@paytm, 9876543210@ybl
            </p>
            {errors.upiId && (
              <p className="text-red-400 text-xs sm:text-sm mt-1">{errors.upiId}</p>
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
      {/* Create Project Options */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="text-center mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-4">Create New Project</h2>
          <p className="text-gray-300">Choose how you'd like to start your project</p>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Start New Project */}
          <button
            onClick={() => setShowCreateProjectModal(true)}
            className="p-8 bg-purple-600 hover:bg-purple-700 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-purple-400"
          >
            <div className="text-center">
              <Plus className="h-12 w-12 text-white mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Start New Project</h3>
              <p className="text-purple-100">Create a fresh project from scratch</p>
            </div>
          </button>

          {/* Resume Existing Project */}
          <button className="p-8 bg-gray-700 hover:bg-gray-600 rounded-xl transition-all duration-200 transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gray-400">
            <div className="text-center">
              <Clock className="h-12 w-12 text-gray-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Resume Existing Project</h3>
              <p className="text-gray-300">Continue working on saved projects</p>
            </div>
          </button>
        </div>
      </div>

      {/* Create Project Modal */}
      {showCreateProjectModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 px-4">
          <div className="bg-gray-800 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-700">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">Create New Project</h3>
              <button
                onClick={() => setShowCreateProjectModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <p className="text-gray-300 mb-6">Fill in the details below to start your new project with a freelancer.</p>

            <form className="space-y-6">
              {/* Project ID */}
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Project ID (Read-only)
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value="Will be auto generated"
                    disabled
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Shield className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-1">Project ID will be automatically generated after form submission</p>
              </div>

              {/* Project Category */}
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Project Category *
                </label>
                <div className="relative">
                  <select
                    value={projectData.projectCategory}
                    onChange={(e) => handleProjectInputChange('projectCategory', e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:border-purple-400"
                  >
                    <option value="Video Production">Video Production</option>
                    <option value="Web Development">Web Development</option>
                    <option value="Graphic Design">Graphic Design</option>
                    <option value="Content Writing">Content Writing</option>
                  </select>
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <FileText className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-1">Currently, only Video Production projects are available. Other categories coming soon!</p>
              </div>

              {/* Project Name and Freelancer ID */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-gray-300 text-sm font-semibold mb-2">
                    Project Name *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={projectData.projectName}
                      onChange={(e) => handleProjectInputChange('projectName', e.target.value)}
                      placeholder="Enter your project name"
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <FileText className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 text-sm font-semibold mb-2">
                    Freelancer ID *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={projectData.freelancerId}
                      onChange={(e) => handleProjectInputChange('freelancerId', e.target.value)}
                      placeholder="F123456789"
                      className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400"
                    />
                    <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                      <User className="h-5 w-5 text-purple-400" />
                    </div>
                  </div>
                  <p className="text-gray-400 text-xs mt-1">Format: F followed by 9 digits (e.g., F123456789)</p>
                </div>
              </div>

              {/* Project Requirement */}
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Project Requirement *
                </label>
                <textarea
                  rows={4}
                  value={projectData.projectRequirement}
                  onChange={(e) => handleProjectInputChange('projectRequirement', e.target.value)}
                  placeholder="Describe your project requirements in detail. Include style preferences, target audience, duration, specific elements needed, etc."
                  maxLength={300}
                  className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg bg-gray-700 text-white placeholder-gray-400 focus:outline-none focus:border-purple-400 resize-none"
                />
                <div className="flex justify-between items-center mt-1">
                  <p className="text-gray-400 text-xs">Maximum 300 characters (optional limit: 300)</p>
                  <span className="text-xs text-gray-400">{projectData.projectRequirement.length}/300</span>
                </div>
              </div>

              {/* Desired Completion Date */}
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Desired Completion Date *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    value={projectData.desiredCompletionDate}
                    onChange={(e) => handleProjectInputChange('desiredCompletionDate', e.target.value)}
                    className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:border-purple-400"
                  />
                  <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                    <Calendar className="h-5 w-5 text-purple-400" />
                  </div>
                </div>
                <p className="text-gray-400 text-xs mt-1">Minimum date: Tomorrow</p>
              </div>

              {/* Project Files */}
              <div>
                <label className="block text-gray-300 text-sm font-semibold mb-2">
                  Project Files (Optional)
                </label>
                <div className="border-2 border-dashed border-gray-600 rounded-lg p-8 text-center hover:border-gray-500 transition-colors">
                  <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                  <p className="text-gray-300 font-medium mb-2">Drag and drop files here</p>
                  <p className="text-sm text-gray-400 mb-4">or</p>
                  <button
                    type="button"
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
                  >
                    Browse Files
                  </button>
                  <p className="text-xs text-gray-400 mt-4">
                    Supported formats: PDF, DOC, DOCX, JPG, PNG, MP4, ZIP, etc. Max 10MB per file (max 2 files)
                  </p>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="button"
                onClick={handleCreateProject}
                className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 flex items-center justify-center space-x-2"
              >
                <CheckCircle className="h-5 w-5" />
                <span>Save and Continue to Deliverables</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Deliverables View */}
      {showDeliverablesView && (
        <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
          <div className="mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Project Deliverables Checklist</h2>
            <p className="text-gray-300">Define what you expect to receive from the freelancer. Be specific and clear.</p>
          </div>

          <div className="space-y-4 mb-8">
            {deliverables.map((deliverable) => (
              <div key={deliverable.id} className="flex items-center space-x-4">
                <div className="w-8 h-8 bg-purple-600 rounded-full flex items-center justify-center text-white font-semibold">
                  {deliverable.id}
                </div>
                <input
                  type="text"
                  value={deliverable.description}
                  onChange={(e) => updateDeliverable(deliverable.id, e.target.value)}
                  className="flex-1 px-4 py-3 border-2 border-gray-600 rounded-lg bg-gray-700 text-white focus:outline-none focus:border-purple-400"
                />
                <button
                  onClick={() => removeDeliverable(deliverable.id)}
                  className="p-2 text-red-400 hover:text-red-300 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <button
              onClick={addDeliverable}
              className="flex items-center justify-center space-x-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400"
            >
              <Plus className="h-4 w-4" />
              <span>Add Deliverable ({deliverables.length}/15)</span>
            </button>

            <button className="flex items-center justify-center space-x-2 px-6 py-3 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400">
              <FileText className="h-4 w-4" />
              <span>Generate Deliverables with AI</span>
            </button>
          </div>

          <button
            onClick={() => {
              setShowDeliverablesView(false);
              setActiveTab('my-projects');
            }}
            className="w-full py-4 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-semibold text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 flex items-center justify-center space-x-2"
          >
            <CheckCircle className="h-5 w-5" />
            <span>Add Deliverable Checklist</span>
          </button>
        </div>
      )}
    </div>
  );

  const renderMyProjectsContent = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">My Projects</h2>
            <p className="text-sm sm:text-base text-gray-300">
              Manage and track your active and completed projects
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Building className="h-4 w-4" />
            <span>16 Total Projects</span>
          </div>
        </div>

        {/* Projects Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700">
                <th className="text-left p-4 text-gray-300 font-semibold">Project ID</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Project Name</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Freelancer ID</th>
                <th className="text-center p-4 text-gray-300 font-semibold">Project Status</th>
                <th className="text-center p-4 text-gray-300 font-semibold">Deliverable Checklist</th>
                <th className="text-center p-4 text-gray-300 font-semibold">Final Work</th>
                <th className="text-center p-4 text-gray-300 font-semibold">Verification Report</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800">
              {[
                { id: 'V1024', name: 'first video test', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1023', name: 'Training Video', freelancer: 'F214000319', status: 'Project Created', action: 'Edit (13)' },
                { id: 'V1022', name: 'Training Video', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1021', name: 'Training Video', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1020', name: 'Training Video', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1019', name: 'aitest8', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1018', name: 'Aitest7', freelancer: 'F214000319', status: 'Fund Secured', action: 'View (10)' },
                { id: 'V1017', name: 'Aitest6', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1016', name: 'Aitest5', freelancer: 'F214000319', status: 'Fund Secured', action: 'View (6)' },
                { id: 'V1015', name: 'aitest4', freelancer: 'F214000319', status: 'Project Created', action: 'Edit (8)' },
                { id: 'V1014', name: 'aitest3', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1013', name: 'AI test2', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1012', name: 'AI test1', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1011', name: 'test1', freelancer: 'F214000319', status: 'Project Created', action: 'Add Deliverables' },
                { id: 'V1010', name: 'test2', freelancer: 'F214000319', status: 'Fund Secured', action: 'View (3)' }
              ].map((project) => (
                <tr key={project.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4 text-white">{project.id}</td>
                  <td className="p-4 text-white">{project.name}</td>
                  <td className="p-4 text-white">{project.freelancer}</td>
                  <td className="p-4 text-center">
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                      project.status === 'Fund Secured' 
                        ? 'bg-green-900/20 text-green-400 border border-green-500/30'
                        : 'bg-blue-900/20 text-blue-400 border border-blue-500/30'
                    }`}>
                      {project.status}
                    </span>
                  </td>
                  <td className="p-4 text-center">
                    <button className={`px-3 py-1 rounded text-xs font-medium ${
                      project.action.includes('View') || project.action.includes('Edit')
                        ? 'bg-purple-600 hover:bg-purple-700 text-white'
                        : 'bg-purple-600 hover:bg-purple-700 text-white'
                    }`}>
                      {project.action}
                    </button>
                  </td>
                  <td className="p-4 text-center text-gray-400">-</td>
                  <td className="p-4 text-center text-gray-400">-</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  const renderTransactionsContent = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Transaction History</h2>
            <p className="text-sm sm:text-base text-gray-300">
              View your payment history and project transactions
            </p>
          </div>
          <button className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-green-400">
            Fund Escrow
          </button>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto mb-8">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-700">
                <th className="text-left p-4 text-gray-300 font-semibold">Project ID</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Project Name</th>
                <th className="text-left p-4 text-gray-300 font-semibold">Freelancer ID</th>
                <th className="text-right p-4 text-gray-300 font-semibold">Value (₹)</th>
                <th className="text-center p-4 text-gray-300 font-semibold">Transaction Status</th>
              </tr>
            </thead>
            <tbody className="bg-gray-800">
              {[
                { id: 'V1018', name: 'Aitest7', freelancer: 'F214000319', value: '₹55,000', status: 'Fund Secured' },
                { id: 'V1016', name: 'Aitest5', freelancer: 'F214000319', value: '₹45,000', status: 'Fund Secured' },
                { id: 'V1010', name: 'test2', freelancer: 'F214000319', value: '₹25,000', status: 'Fund Secured' },
                { id: 'V1009', name: 'sixthtest', freelancer: 'F214000319', value: '₹32,000', status: 'Fund Secured' }
              ].map((transaction) => (
                <tr key={transaction.id} className="border-t border-gray-700 hover:bg-gray-700/50">
                  <td className="p-4 text-white">{transaction.id}</td>
                  <td className="p-4 text-white">{transaction.name}</td>
                  <td className="p-4 text-white">{transaction.freelancer}</td>
                  <td className="p-4 text-right text-white font-semibold">{transaction.value}</td>
                  <td className="p-4 text-center">
                    <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-900/20 text-green-400 border border-green-500/30">
                      {transaction.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-red-400 mb-2">₹157,000</div>
            <div className="text-sm text-gray-300">Total Spent</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-blue-400 mb-2">4</div>
            <div className="text-sm text-gray-300">Projects Funded</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-6 text-center">
            <div className="text-3xl font-bold text-purple-400 mb-2">₹39250</div>
            <div className="text-sm text-gray-300">Average Project Cost</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderChatContent = () => (
    <div className="space-y-6 sm:space-y-8">
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Chat</h2>
          <p className="text-sm sm:text-base text-gray-300">
            Communicate with freelancers about your projects
          </p>
        </div>

        <div className="text-center py-12">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
            <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-white mb-2">
            No conversations yet
          </h3>
          <p className="text-sm sm:text-base text-gray-400 max-w-md mx-auto">
            Start a conversation with a freelancer to discuss project details, deliverables, and progress updates.
          </p>
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
      case 'my-projects':
        return renderMyProjectsContent();
      case 'transactions':
        return renderTransactionsContent();
      case 'chat':
        return renderChatContent();
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
            {/* Logo */}
            <Link to="/" className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-purple-400 rounded-lg p-1">
              <Shield className="h-8 w-8 text-purple-400" />
              <span className="text-xl font-bold text-white">SecureServe</span>
            </Link>

            {/* User Menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-gray-300 text-sm sm:text-base hidden sm:inline">
                Welcome, {profileData.fullName || 'Subham'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
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
            <div className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-purple-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
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
        <div>{renderTabContent()}</div>
      </main>
    </div>
  );
};

export default ClientDashboard;
import React, { useState, useEffect } from 'react';
import { User, Briefcase, CreditCard, MessageSquare, CheckCircle, Clock, Shield, Edit3, Save, X, Upload } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { getCurrentUser, signOut } from '../lib/supabase';

interface ProfileData {
  fullName: string;
  email: string;
  mobileNumber: string;
  countryCode: string;
  upiId: string;
  aadharNumber: string;
  freelancerId: string;
}

const FreelancerDashboard: React.FC = () => {
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
    upiId: '',
    aadharNumber: '',
    freelancerId: ''
  });
  const [originalData, setOriginalData] = useState<ProfileData>({
    fullName: '',
    email: '',
    mobileNumber: '',
    countryCode: '+91',
    upiId: '',
    aadharNumber: '',
    freelancerId: ''
  });
  const [errors, setErrors] = useState<Partial<ProfileData>>({});

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
              upiId: profile.upi_id || '',
              aadharNumber: profile.aadhar_number || '',
              freelancerId: profile.freelancer_id || ''
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
    const fields = ['fullName', 'mobileNumber', 'upiId', 'aadharNumber'];
    const completed = fields.filter(field => profileData[field as keyof ProfileData].trim() !== '').length;
    return Math.round((completed / fields.length) * 100);
  };

  // Generate unique freelancer ID based on email
  const generateFreelancerId = (email: string) => {
    // Create a hash from email for consistency
    let hash = 0;
    for (let i = 0; i < email.length; i++) {
      const char = email.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Convert to positive number and ensure 9 digits
    const positiveHash = Math.abs(hash);
    const nineDigitId = String(positiveHash).padStart(9, '0').slice(0, 9);
    return `F${nineDigitId}`;
  };
  // Handle input changes
  const handleInputChange = (field: keyof ProfileData, value: string) => {
    setProfileData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  // Format Aadhar number with hyphens
  const formatAadhar = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 4) return numbers;
    if (numbers.length <= 8) return `${numbers.slice(0, 4)}-${numbers.slice(4)}`;
    return `${numbers.slice(0, 4)}-${numbers.slice(4, 8)}-${numbers.slice(8, 12)}`;
  };

  // Mask Aadhar number for display
  const maskAadhar = (aadhar: string) => {
    if (aadhar.length < 4) return aadhar;
    const formatted = formatAadhar(aadhar);
    return formatted.replace(/\d(?=\d{4})/g, 'x');
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

    if (!profileData.upiId.trim()) {
      newErrors.upiId = 'UPI ID is required';
    } else if (!/^[\w.-]+@[\w.-]+$/.test(profileData.upiId)) {
      newErrors.upiId = 'Please enter a valid UPI ID';
    }

    if (!profileData.aadharNumber.trim()) {
      newErrors.aadharNumber = 'Aadhar number is required';
    } else if (!/^\d{12}$/.test(profileData.aadharNumber.replace(/\D/g, ''))) {
      newErrors.aadharNumber = 'Please enter a valid 12-digit Aadhar number';
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
          user_type: 'freelancer',
          full_name: profileData.fullName,
          mobile_number: profileData.mobileNumber,
          country_code: profileData.countryCode,
          upi_id: profileData.upiId,
          aadhar_number: profileData.aadharNumber,
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
            freelancerId: data.freelancer_id || profileData.freelancerId
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

  const renderProfileContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Welcome Banner for New Users */}
      {isNewUser && (
        <div 
          className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border border-cyan-500/30 rounded-2xl p-4 sm:p-6"
          role="alert"
          aria-live="polite"
        >
          <div className="flex flex-col sm:flex-row sm:items-start space-y-3 sm:space-y-0 sm:space-x-4">
            <div className="flex-shrink-0">
              <CheckCircle className="h-6 w-6 sm:h-8 sm:w-8 text-cyan-400" aria-hidden="true" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
                Welcome to SecureServe! 🎉
              </h2>
              <p className="text-sm sm:text-base text-gray-300 mb-4">
                Please complete your profile information to get started with projects and receive secure payments.
              </p>
              <div className="flex flex-col sm:flex-row sm:items-center space-y-2 sm:space-y-0 sm:space-x-4">
                <div className="flex items-center space-x-2 w-full sm:w-auto">
                  <div className="flex-1 sm:w-32 bg-gray-700 rounded-full h-2" role="progressbar" aria-valuenow={calculateCompletion()} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completion progress">
                    <div 
                      className="bg-gradient-to-r from-cyan-400 to-purple-400 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${calculateCompletion()}%` }}
                    ></div>
                  </div>
                  <span className="text-sm font-medium text-cyan-400 whitespace-nowrap">
                    {calculateCompletion()}% Complete
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Last Updated Info for Returning Users */}
      {!isNewUser && lastUpdated && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-2 sm:space-y-0">
          <div className="flex items-center space-x-2">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400" aria-hidden="true" />
            <span className="text-sm sm:text-base text-gray-300">
              Last updated: {lastUpdated.toLocaleDateString()} at {lastUpdated.toLocaleTimeString()}
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-400" aria-hidden="true" />
            <span className="text-sm sm:text-base text-green-400 font-medium">Profile Complete</span>
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
              className="flex items-center justify-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 focus:bg-cyan-700 text-white rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 w-full sm:w-auto"
              aria-label="Edit profile information"
            >
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              <span>Edit Profile</span>
            </button>
          )}
        </div>

        <form className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8" noValidate>
          {/* Freelancer ID */}
          <div className="lg:col-span-2">
            <label htmlFor="freelancer-id" className="block text-gray-300 text-sm font-semibold mb-2">
              Freelancer ID
            </label>
            <div className="relative">
              <input
                id="freelancer-id"
                name="freelancerId"
                type="text"
                value={profileData.freelancerId || 'Will be assigned after profile completion'}
                disabled
                className="w-full px-4 py-3 pr-12 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60 text-sm sm:text-base"
                aria-describedby="freelancer-id-help"
                tabIndex={-1}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Shield className="h-5 w-5 text-cyan-400" aria-hidden="true" />
              </div>
            </div>
            <p id="freelancer-id-help" className="text-gray-400 text-xs sm:text-sm mt-1">
              {profileData.freelancerId 
                ? 'Your unique freelancer identification number' 
                : 'ID will be automatically generated when you complete your profile'
              }
            </p>
          </div>

          {/* Full Name */}
          <div>
            <label htmlFor="full-name" className="block text-gray-300 text-sm font-semibold mb-2">
              Full Name *
            </label>
            <input
              id="full-name"
              name="fullName"
              type="text"
              value={profileData.fullName}
              onChange={(e) => handleInputChange('fullName', e.target.value)}
              placeholder="Enter your full legal name"
              disabled={!isEditing}
              required
              aria-invalid={errors.fullName ? 'true' : 'false'}
              aria-describedby={errors.fullName ? 'full-name-error' : undefined}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.fullName 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            {errors.fullName && (
              <p id="full-name-error" className="text-red-400 text-xs sm:text-sm mt-1" role="alert">
                {errors.fullName}
              </p>
            )}
          </div>

          {/* Email Address (Read-only) */}
          <div>
            <label htmlFor="email" className="block text-gray-300 text-sm font-semibold mb-2">
              Email Address
            </label>
            <input
              id="email"
              name="email"
              type="email"
              value={profileData.email}
              disabled
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg bg-gray-600 text-gray-300 cursor-not-allowed opacity-60 text-sm sm:text-base"
              aria-describedby="email-help"
              tabIndex={-1}
            />
            <p id="email-help" className="text-gray-400 text-xs sm:text-sm mt-1">Email cannot be changed</p>
          </div>

          {/* Mobile Number */}
          <div>
            <label htmlFor="mobile-number" className="block text-gray-300 text-sm font-semibold mb-2">
              Mobile Number *
            </label>
            <div className="flex space-x-2">
              <select
                id="country-code"
                name="countryCode"
                value={profileData.countryCode}
                onChange={(e) => handleInputChange('countryCode', e.target.value)}
                disabled={!isEditing}
                aria-label="Country code"
                className={`px-2 sm:px-3 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white text-sm sm:text-base ${
                  'border-gray-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50'
                } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              >
                {countryCodes.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.code}
                  </option>
                ))}
              </select>
              <input
                id="mobile-number"
                name="mobileNumber"
                type="tel"
                value={profileData.mobileNumber}
                onChange={(e) => handleInputChange('mobileNumber', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="Enter 10-digit mobile number"
                disabled={!isEditing}
                required
                maxLength={10}
                aria-invalid={errors.mobileNumber ? 'true' : 'false'}
                aria-describedby={errors.mobileNumber ? 'mobile-error' : undefined}
                className={`flex-1 px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  errors.mobileNumber 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50'
                } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
            </div>
            {errors.mobileNumber && (
              <p id="mobile-error" className="text-red-400 text-xs sm:text-sm mt-1" role="alert">
                {errors.mobileNumber}
              </p>
            )}
          </div>

          {/* UPI ID */}
          <div>
            <label htmlFor="upi-id" className="block text-gray-300 text-sm font-semibold mb-2">
              UPI ID *
            </label>
            <input
              id="upi-id"
              name="upiId"
              type="text"
              value={profileData.upiId}
              onChange={(e) => handleInputChange('upiId', e.target.value)}
              placeholder="yourname@paytm, 9876543210@ybl"
              disabled={!isEditing}
              required
              aria-invalid={errors.upiId ? 'true' : 'false'}
              aria-describedby={`upi-help ${errors.upiId ? 'upi-error' : ''}`.trim()}
              className={`w-full px-4 py-3 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                errors.upiId 
                  ? 'border-red-500 focus:border-red-400' 
                  : 'border-gray-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50'
              } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
            />
            <p id="upi-help" className="text-gray-400 text-xs sm:text-sm mt-1">
              Example: yourname@paytm, 9876543210@ybl
            </p>
            {errors.upiId && (
              <p id="upi-error" className="text-red-400 text-xs sm:text-sm mt-1" role="alert">
                {errors.upiId}
              </p>
            )}
          </div>

          {/* Aadhar Card Number */}
          <div className="lg:col-span-2">
            <label htmlFor="aadhar-number" className="block text-gray-300 text-sm font-semibold mb-2">
              Aadhar Card Number *
            </label>
            <div className="relative">
              <input
                id="aadhar-number"
                name="aadharNumber"
                type="text"
                value={isEditing ? formatAadhar(profileData.aadharNumber) : maskAadhar(profileData.aadharNumber)}
                onChange={(e) => {
                  const numbers = e.target.value.replace(/\D/g, '');
                  handleInputChange('aadharNumber', numbers);
                }}
                placeholder="xxxx-xxxx-xxxx"
                disabled={!isEditing}
                maxLength={14}
                required
                aria-invalid={errors.aadharNumber ? 'true' : 'false'}
                aria-describedby={`aadhar-help ${errors.aadharNumber ? 'aadhar-error' : ''}`.trim()}
                className={`w-full px-4 py-3 pr-12 border-2 rounded-lg focus:outline-none transition-colors bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base ${
                  errors.aadharNumber 
                    ? 'border-red-500 focus:border-red-400' 
                    : 'border-gray-600 focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50'
                } ${!isEditing ? 'opacity-60 cursor-not-allowed' : ''}`}
              />
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <Shield className="h-5 w-5 text-green-400" aria-hidden="true" />
              </div>
            </div>
            <div className="flex items-center space-x-2 mt-1">
              <Shield className="h-4 w-4 text-green-400" aria-hidden="true" />
              <p id="aadhar-help" className="text-green-400 text-xs sm:text-sm">
                Your Aadhar details are encrypted and secure
              </p>
            </div>
            {errors.aadharNumber && (
              <p id="aadhar-error" className="text-red-400 text-xs sm:text-sm mt-1" role="alert">
                {errors.aadharNumber}
              </p>
            )}
          </div>
        </form>

        {/* Action Buttons */}
        {isEditing && (
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-end space-y-3 sm:space-y-0 sm:space-x-4 mt-6 sm:mt-8 pt-6 border-t border-gray-700">
            <button
              onClick={handleCancel}
              className="flex items-center justify-center space-x-2 px-6 py-3 border border-gray-600 text-gray-300 rounded-lg hover:bg-gray-700 focus:bg-gray-700 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-400"
              type="button"
              aria-label="Cancel profile changes"
            >
              <X className="h-4 w-4" aria-hidden="true" />
              <span>Cancel</span>
            </button>
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              type="button"
              aria-label="Save profile changes"
              className={`flex items-center justify-center space-x-2 px-6 py-3 rounded-lg transition-colors focus:outline-none focus:ring-2 ${
                hasChanges 
                  ? 'bg-cyan-600 hover:bg-cyan-700 focus:bg-cyan-700 text-white focus:ring-cyan-400' 
                  : 'bg-gray-600 text-gray-400 cursor-not-allowed focus:ring-gray-400'
              }`}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
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
              Manage and track your active and completed projects
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <Briefcase className="h-4 w-4" aria-hidden="true" />
            <span>0 Total Projects</span>
          </div>
        </div>

        {/* Projects Table */}
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="bg-gray-700 rounded-t-lg">
              <div className="grid grid-cols-7 gap-4 p-4 text-sm font-semibold text-gray-300">
                <div className="text-left">Project ID</div>
                <div className="text-left">Project Name</div>
                <div className="text-left">Client ID</div>
                <div className="text-center">Status</div>
                <div className="text-center">Deliverable List</div>
                <div className="text-center">Work Product</div>
                <div className="text-center">Verification Report</div>
              </div>
            </div>

            {/* Table Body - Empty State */}
            <div className="bg-gray-800 rounded-b-lg border-t border-gray-600">
              <div className="p-8 sm:p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center">
                    <Briefcase className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-semibold text-white">
                      No Projects Yet
                    </h3>
                    <p className="text-sm sm:text-base text-gray-400 max-w-md">
                      Your projects will appear here once clients start hiring you. 
                      Make sure your profile is complete to attract more clients.
                    </p>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => setActiveTab('profile')}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 focus:bg-cyan-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      aria-label="Complete your profile"
                    >
                      <User className="h-4 w-4" aria-hidden="true" />
                      <span>Complete Profile</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Status Legend */}
        <div className="mt-6 p-4 bg-gray-700 rounded-lg">
          <h4 className="text-sm font-semibold text-gray-300 mb-3">Project Status Legend:</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs sm:text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span className="text-gray-300">Complete</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
              <span className="text-gray-300">Active</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <span className="text-gray-300">Manual Revision</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-purple-500 rounded-full"></div>
              <span className="text-gray-300">Approval Pending</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTransactionsContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Transactions Header */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 sm:mb-8 space-y-4 sm:space-y-0">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Transaction History</h2>
            <p className="text-sm sm:text-base text-gray-300">
              View your payment history and completed transactions
            </p>
          </div>
          <div className="flex items-center space-x-2 text-sm text-gray-400">
            <CreditCard className="h-4 w-4" aria-hidden="true" />
            <span>₹0 Total Earned</span>
          </div>
        </div>

        {/* Transactions Table */}
        <div className="overflow-x-auto">
          <div className="min-w-full">
            {/* Table Header */}
            <div className="bg-gray-700 rounded-t-lg">
              <div className="grid grid-cols-5 gap-4 p-4 text-sm font-semibold text-gray-300">
                <div className="text-left">Project ID</div>
                <div className="text-left">Project Name</div>
                <div className="text-left">Client ID</div>
                <div className="text-right">Value (₹)</div>
                <div className="text-center">Value Status</div>
              </div>
            </div>

            {/* Table Body - Empty State */}
            <div className="bg-gray-800 rounded-b-lg border-t border-gray-600">
              <div className="p-8 sm:p-12 text-center">
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center">
                    <CreditCard className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" aria-hidden="true" />
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-lg sm:text-xl font-semibold text-white">
                      No Transactions Yet
                    </h3>
                    <p className="text-sm sm:text-base text-gray-400 max-w-md">
                      Your payment history will appear here once you complete projects and receive payments. 
                      All transactions are secure and processed instantly.
                    </p>
                  </div>
                  <div className="pt-4">
                    <button
                      onClick={() => setActiveTab('projects')}
                      className="inline-flex items-center space-x-2 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 focus:bg-cyan-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
                      aria-label="View your projects"
                    >
                      <Briefcase className="h-4 w-4" aria-hidden="true" />
                      <span>View Projects</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction Summary */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-green-400">₹0</div>
            <div className="text-sm text-gray-300">Total Earned</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-blue-400">0</div>
            <div className="text-sm text-gray-300">Completed Projects</div>
          </div>
          <div className="bg-gray-700 rounded-lg p-4 text-center">
            <div className="text-2xl font-bold text-purple-400">₹0</div>
            <div className="text-sm text-gray-300">Average Project Value</div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderMessagesContent = () => (
    <div className="space-y-6 sm:space-y-8">
      {/* Message Composition Form */}
      <div className="bg-gray-800 rounded-2xl p-4 sm:p-6 lg:p-8 border border-gray-700">
        <div className="mb-6 sm:mb-8">
          <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Send Message</h2>
          <p className="text-sm sm:text-base text-gray-300">
            Communicate with clients about your projects
          </p>
        </div>

        <form className="space-y-6" noValidate>
          {/* Client ID Selection */}
          <div>
            <label htmlFor="client-select" className="block text-gray-300 text-sm font-semibold mb-2">
              Select Client *
            </label>
            <select
              id="client-select"
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 bg-gray-700 text-white text-sm sm:text-base"
              required
            >
              <option value="">Choose a client...</option>
              <option value="C123456789">TechCorp Solutions (ID: C123456789)</option>
              <option value="C987654321">Digital Marketing Pro (ID: C987654321)</option>
              <option value="C456789123">Creative Studios Ltd (ID: C456789123)</option>
            </select>
          </div>

          {/* Project ID Selection */}
          <div>
            <label htmlFor="project-select" className="block text-gray-300 text-sm font-semibold mb-2">
              Select Project *
            </label>
            <select
              id="project-select"
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 bg-gray-700 text-white text-sm sm:text-base"
              required
            >
              <option value="">Choose a project...</option>
              <option value="P67890">Corporate Video Production (ID: P67890)</option>
              <option value="P54321">Social Media Campaign (ID: P54321)</option>
              <option value="P98765">Product Demo Video (ID: P98765)</option>
            </select>
          </div>

          {/* Subject Category */}
          <div>
            <label htmlFor="subject-category" className="block text-gray-300 text-sm font-semibold mb-2">
              Subject Category *
            </label>
            <select
              id="subject-category"
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 bg-gray-700 text-white text-sm sm:text-base"
              required
            >
              <option value="">Select category...</option>
              <option value="deliverable-checklist">Deliverable Checklist</option>
              <option value="work-verification">Work Verification</option>
              <option value="manual-revision">Invoking Manual Revision</option>
              <option value="work-approval">Work Approval</option>
            </select>
          </div>

          {/* Message Content */}
          <div>
            <label htmlFor="message-content" className="block text-gray-300 text-sm font-semibold mb-2">
              Message Content *
            </label>
            <textarea
              id="message-content"
              rows={6}
              placeholder="Type your message here..."
              maxLength={1000}
              className="w-full px-4 py-3 border-2 border-gray-600 rounded-lg focus:outline-none focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/50 bg-gray-700 text-white placeholder-gray-400 text-sm sm:text-base resize-none"
              required
            />
            <div className="flex justify-between items-center mt-1">
              <p className="text-gray-400 text-xs sm:text-sm">Maximum 1000 characters</p>
              <span className="text-xs sm:text-sm text-gray-400">0/1000</span>
            </div>
          </div>

          {/* File Attachments */}
          <div>
            <label className="block text-gray-300 text-sm font-semibold mb-2">
              File Attachments (Optional)
            </label>
            <div className="border-2 border-dashed border-gray-600 rounded-lg p-6 text-center hover:border-gray-500 transition-colors">
              <Upload className="mx-auto h-8 w-8 text-gray-400 mb-4" />
              <p className="text-gray-300 font-medium mb-2">
                Drag and drop files here
              </p>
              <p className="text-sm text-gray-400 mb-4">or</p>
              <button
                type="button"
                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
              >
                Browse Files
              </button>
              <p className="text-xs text-gray-400 mt-4">
                Supported: PDF, DOC, DOCX, JPG, PNG, MP4, ZIP, etc. Max 10MB per file
              </p>
            </div>
          </div>

          {/* Send Button */}
          <div className="pt-6 border-t border-gray-700">
            <button
              type="submit"
              className="w-full flex items-center justify-center space-x-2 py-3 sm:py-4 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg font-semibold text-base sm:text-lg transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400"
            >
              <MessageSquare className="h-5 w-5" />
              <span>Send Message</span>
            </button>
          </div>
        </form>
      </div>

      {/* Messages Thread */}
      <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 border border-gray-700 text-center">
        <div className="flex flex-col items-center space-y-4">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-700 rounded-full flex items-center justify-center">
            <MessageSquare className="h-8 w-8 sm:h-10 sm:w-10 text-gray-400" aria-hidden="true" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg sm:text-xl font-semibold text-white">
              No messages yet
            </h3>
            <p className="text-sm sm:text-base text-gray-400 max-w-md">
              Start a conversation with a client to discuss project details, deliverables, and approvals.
            </p>
          </div>
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
      case 'transactions':
        return renderTransactionsContent();
      case 'messages':
        return renderMessagesContent();
      default:
        return renderProfileContent();
    }
  };

  return (
    <div className="min-h-screen bg-gray-900" role="main">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-4 sm:px-6 lg:px-8" role="banner">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link 
              to="/" 
              className="flex items-center space-x-2 focus:outline-none focus:ring-2 focus:ring-cyan-400 rounded-lg p-1"
              aria-label="SecureServe Home"
            >
              <Shield className="h-8 w-8 text-cyan-400" />
              <span className="text-xl font-bold text-white">SecureServe</span>
            </Link>

            {/* User Menu */}
            <div className="flex items-center space-x-2 sm:space-x-4">
              <span className="text-gray-300 text-sm sm:text-base hidden sm:inline">
                Welcome, {profileData.fullName || 'Freelancer'}
              </span>
              <button
                onClick={handleLogout}
                className="px-3 py-2 sm:px-4 bg-red-600 hover:bg-red-700 focus:bg-red-700 text-white rounded-lg transition-colors text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                aria-label="Logout from dashboard"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8" role="main">
        {/* Tab Navigation */}
        <nav className="mb-6 sm:mb-8" role="navigation" aria-label="Dashboard navigation">
          <div className="border-b border-gray-700">
            <div className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto scrollbar-hide">
              {tabs.map((tab) => {
                const IconComponent = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-1 sm:space-x-2 py-3 sm:py-4 px-1 sm:px-2 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-400 focus:ring-offset-2 focus:ring-offset-gray-900 ${
                      activeTab === tab.id
                        ? 'border-cyan-400 text-cyan-400'
                        : 'border-transparent text-gray-400 hover:text-gray-300 hover:border-gray-300'
                    }`}
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`${tab.id}-panel`}
                    id={`${tab.id}-tab`}
                  >
                    <IconComponent className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>

        {/* Tab Content */}
        <div 
          role="tabpanel" 
          id={`${activeTab}-panel`} 
          aria-labelledby={`${activeTab}-tab`}
        >
          {renderTabContent()}
        </div>
      </main>
    </div>
  );
};

export default FreelancerDashboard;
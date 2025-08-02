import React, { useState, useEffect } from 'react';
import { User, Briefcase, CreditCard, MessageSquare, CheckCircle, Clock, Shield, Edit3, Save, X, Upload, Plus, BarChart3, TrendingUp, Calendar, DollarSign, Users, AlertCircle, Loader, FileText, Folder, Wand2, Minus, Brain, Play, Camera, Palette, Music, Film, Monitor, Mic } from 'lucide-react';
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
    { id: 'ai-analysis', label: 'AI Analysis', icon: Brain },
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
          setCurrentResponse(result.response ||
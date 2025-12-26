import { useState, useEffect } from 'react';
import './IntegrationForm.css';

const IntegrationForm = () => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitMessage, setSubmitMessage] = useState({ type: '', text: '' });
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState('');

  // Dynamic configuration from API
  const [campaigns, setCampaigns] = useState([]);
  const [campaignConfig, setCampaignConfig] = useState({});
  const [transferSettings, setTransferSettings] = useState([]);

  const [formData, setFormData] = useState({
    campaign: '',
    model: '',
    numberOfBots: '',
    transferSettingsId: '',
    setupType: 'same',
    primaryIpValidation: '',
    primaryAdminLink: '',
    primaryUser: '',
    primaryPassword: '',
    primaryBotsCampaign: '',
    primaryUserSeries: '',
    primaryPort: '5060',
    closerIpValidation: '',
    closerAdminLink: '',
    closerUser: '',
    closerPassword: '',
    closerCampaign: '',
    closerIngroup: '',
    closerPort: '5060',
    companyName: '',
    customRequirements: ''
  });

  const [availableModels, setAvailableModels] = useState([]);
  const [availableTransferSettings, setAvailableTransferSettings] = useState([]);

  // Fetch form configuration on mount
  useEffect(() => {
    fetchFormConfig();
  }, []);

  const fetchFormConfig = async () => {
    try {
      setIsLoadingConfig(true);
      setConfigError('');

      const response = await fetch('https://api.xlitecore.xdialnetworks.com/api/v1/integration/form', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to load form configuration');
      }

      const config = await response.json();
      
      console.log('Form config loaded:', config);

      setCampaigns(config.campaigns || []);
      setCampaignConfig(config.campaign_config || {});
      setTransferSettings(config.transfer_settings || []);

    } catch (error) {
      console.error('Error loading form config:', error);
      setConfigError('Failed to load form configuration. Please refresh the page.');
    } finally {
      setIsLoadingConfig(false);
    }
  };

  // Update available models when campaign changes
  useEffect(() => {
    if (formData.campaign && campaignConfig[formData.campaign]) {
      const models = Object.keys(campaignConfig[formData.campaign]);
      setAvailableModels(models);
      
      if (!formData.model || !models.includes(formData.model)) {
        setFormData(prev => ({ ...prev, model: models[0] || '', transferSettingsId: '' }));
      }
    } else {
      setAvailableModels([]);
      setAvailableTransferSettings([]);
    }
  }, [formData.campaign, campaignConfig]);

  // Update available transfer settings when model changes
  useEffect(() => {
    if (formData.campaign && formData.model && campaignConfig[formData.campaign]?.[formData.model]) {
      const settings = campaignConfig[formData.campaign][formData.model];
      setAvailableTransferSettings(settings);
      
      const recommended = settings.find(s => {
        const fullSetting = transferSettings.find(ts => ts.id === s.id);
        return fullSetting?.is_recommended;
      });
      
      if (!formData.transferSettingsId || !settings.find(s => s.id === formData.transferSettingsId)) {
        setFormData(prev => ({ 
          ...prev, 
          transferSettingsId: recommended ? recommended.id : (settings[0]?.id || '')
        }));
      }
    } else {
      setAvailableTransferSettings([]);
    }
  }, [formData.campaign, formData.model, campaignConfig, transferSettings]);

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'number' ? (value === '' ? '' : parseInt(value)) : value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitMessage({ type: '', text: '' });

    try {
      // Client-side validation for required fields
      const requiredFields = [
        { field: 'companyName', label: 'Company Name' },
        { field: 'campaign', label: 'Campaign Type' },
        { field: 'model', label: 'Model' },
        { field: 'transferSettingsId', label: 'Transfer Quality Settings' },
        { field: 'numberOfBots', label: 'Number of Remote Agents' },
        { field: 'primaryIpValidation', label: 'IP Validation Link' },
        { field: 'primaryAdminLink', label: 'Admin Link' },
        { field: 'primaryUser', label: 'Username' },
        { field: 'primaryPassword', label: 'Password' },
      ];

      const missingFields = requiredFields.filter(f => !formData[f.field] || formData[f.field] === '');
      
      if (missingFields.length > 0) {
        const fieldNames = missingFields.map(f => f.label).join(', ');
        throw new Error(`Please fill in the following required fields: ${fieldNames}`);
      }

      const apiPayload = {
        company_name: formData.companyName,
        campaign: formData.campaign,
        model_name: formData.model,
        transfer_settings_id: parseInt(formData.transferSettingsId),
        number_of_bots: parseInt(formData.numberOfBots),
        setup_type: formData.setupType,
        primary_ip_validation: formData.primaryIpValidation,
        primary_admin_link: formData.primaryAdminLink,
        primary_user: formData.primaryUser,
        primary_password: formData.primaryPassword,
        primary_port: parseInt(formData.primaryPort),
      };

      if (formData.primaryBotsCampaign?.trim()) apiPayload.primary_bots_campaign = formData.primaryBotsCampaign;
      if (formData.primaryUserSeries?.trim()) apiPayload.primary_user_series = formData.primaryUserSeries;
      if (formData.closerIpValidation?.trim()) apiPayload.closer_ip_validation = formData.closerIpValidation;
      if (formData.closerAdminLink?.trim()) apiPayload.closer_admin_link = formData.closerAdminLink;
      if (formData.closerUser?.trim()) apiPayload.closer_user = formData.closerUser;
      if (formData.closerPassword?.trim()) apiPayload.closer_password = formData.closerPassword;
      if (formData.closerCampaign?.trim()) apiPayload.closer_campaign = formData.closerCampaign;
      if (formData.closerIngroup?.trim()) apiPayload.closer_ingroup = formData.closerIngroup;
      if (formData.closerPort && formData.closerPort !== '5060') apiPayload.closer_port = parseInt(formData.closerPort);
      if (formData.customRequirements?.trim()) apiPayload.custom_requirements = formData.customRequirements;

      console.log('Submitting payload:', JSON.stringify(apiPayload, null, 2));

      const response = await fetch('https://api.xlitecore.xdialnetworks.com/api/v1/integration/request', {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(apiPayload)
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error Response:', errorData);
        
        // Check for existing client error
        if (errorData.detail && typeof errorData.detail === 'string') {
          // Check if the error is about existing client
          if (errorData.detail.toLowerCase().includes('already exists') || 
              errorData.detail.toLowerCase().includes('client already') ||
              errorData.detail.toLowerCase().includes('duplicate')) {
            throw new Error('This company is already registered. Please log in and create campaigns from your landing page.');
          }
          
          // Check for "client not found" or similar
          if (errorData.detail.toLowerCase().includes('not found')) {
            throw new Error('Unable to process your request. Please check all fields and try again.');
          }
          
          // Other string errors
          throw new Error(errorData.detail);
        }
        
        // Handle validation errors (422)
        if (response.status === 422 && errorData.detail) {
          if (Array.isArray(errorData.detail)) {
            // Extract field names from validation errors
            const fieldErrors = errorData.detail.map(err => {
              const fieldPath = err.loc ? err.loc.slice(1).join('.') : 'field';
              // Convert snake_case to readable format
              const readableField = fieldPath
                .split('_')
                .map(word => word.charAt(0).toUpperCase() + word.slice(1))
                .join(' ');
              return readableField;
            });
            
            const uniqueFields = [...new Set(fieldErrors)];
            
            if (uniqueFields.length === 1) {
              throw new Error(`Please fill in the ${uniqueFields[0]} field correctly.`);
            } else {
              throw new Error(`Please check the following fields: ${uniqueFields.join(', ')}`);
            }
          }
        }
        
        // Generic error messages based on status code
        if (response.status === 400) {
          throw new Error('Invalid form data. Please check all fields and try again.');
        } else if (response.status === 500) {
          throw new Error('Server error. Please try again later or contact support.');
        }
        
        throw new Error('Unable to submit the form. Please check all fields and try again.');
      }

      const data = await response.json();
      console.log('Success response:', data);
      
      // Check if this is a duplicate client (backend modified the name)
      if (data.success && data.data) {
        const submittedName = formData.companyName.toLowerCase().replace(/\s+/g, '');
        const returnedName = (data.data.client_name || '').toLowerCase().replace(/\s+/g, '');
        const returnedUsername = (data.data.username || '').toLowerCase();
        
        // Check if the returned name/username has been modified with numbers
        const hasNumberPrefix = /^\d+/.test(returnedUsername) || /^\d+/.test(returnedName);
        
        // Check if names don't match (indicating modification)
        const namesDontMatch = submittedName !== returnedName;
        
        if (hasNumberPrefix || (namesDontMatch && returnedUsername.includes(submittedName))) {
          setSubmitMessage({
            type: 'error',
            text: 'This company is already registered. Please log in and create campaigns from your dashboard.'
          });
          
          // Don't reset form for existing clients
          return;
        }
      }
      
      setSubmitMessage({
        type: 'success',
        text: 'Integration request submitted successfully! Our team will contact you shortly.'
      });

      setTimeout(() => {
        setFormData({
          campaign: '',
          model: '',
          numberOfBots: '',
          transferSettingsId: '',
          setupType: 'same',
          primaryIpValidation: '',
          primaryAdminLink: '',
          primaryUser: '',
          primaryPassword: '',
          primaryBotsCampaign: '',
          primaryUserSeries: '',
          primaryPort: '5060',
          closerIpValidation: '',
          closerAdminLink: '',
          closerUser: '',
          closerPassword: '',
          closerCampaign: '',
          closerIngroup: '',
          closerPort: '5060',
          companyName: '',
          customRequirements: ''
        });
        setSubmitMessage({ type: '', text: '' });
      }, 3000);
    } catch (error) {
      console.error('Error submitting form:', error);
      setSubmitMessage({
        type: 'error',
        text: error.message || 'Unable to submit the form. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getTransferSettingDetails = (id) => {
    return transferSettings.find(ts => ts.id === id);
  };

  if (isLoadingConfig) {
    return (
      <div className="integration-form-container">
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading form configuration...</p>
        </div>
      </div>
    );
  }

  if (configError) {
    return (
      <div className="integration-form-container">
        <div className="error-state">
          <i className="bi bi-exclamation-triangle"></i>
          <p>{configError}</p>
          <button onClick={fetchFormConfig} className="retry-btn">
            <i className="bi bi-arrow-clockwise"></i>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="integration-form-container">
      <div className="integration-form-wrapper">
        {/* Header */}
        <div className="form-header">
          <div>
            <h1 className="form-title">Remote Agent Integration Request</h1>
            <p className="form-subtitle">Configure your Remote Agent campaign and integration settings</p>
          </div>
        </div>

        {/* Form - use div with onClick handlers instead of form element */}
        <div className="integration-form">
          {/* Contact Information */}
          <section className="form-section">
            <div className="section-header">
              <i className="bi bi-person-fill"></i>
              <h2>Contact Information</h2>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="companyName">
                  Company Name <span className="required">*</span>
                </label>
                <input
                  type="text"
                  id="companyName"
                  name="companyName"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Your company name"
                  required
                />
              </div>
            </div>
          </section>

          {/* Campaign Configuration */}
          <section className="form-section">
            <div className="section-header">
              <i className="bi bi-robot"></i>
              <h2>Campaign Configuration</h2>
            </div>

            <div className="form-group">
              <label htmlFor="campaign">
                Campaign Type <span className="required">*</span>
              </label>
              <select
                id="campaign"
                name="campaign"
                value={formData.campaign}
                onChange={handleChange}
                required
              >
                <option value="">Select Campaign</option>
                {campaigns.map(campaign => (
                  <option key={campaign} value={campaign}>{campaign}</option>
                ))}
              </select>
            </div>

            {formData.campaign && availableModels.length > 0 && (
              <div className="form-group">
                <label htmlFor="model">
                  Model <span className="required">*</span>
                </label>
                <select
                  id="model"
                  name="model"
                  value={formData.model}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select Model</option>
                  {availableModels.map(model => (
                    <option key={model} value={model}>{model}</option>
                  ))}
                </select>
              </div>
            )}

            {formData.model && availableTransferSettings.length > 0 && (
              <div className="form-group">
                <label>
                  Transfer Quality Settings <span className="required">*</span>
                </label>
                
                <div className="transfer-settings-grid">
                  {availableTransferSettings.map(setting => {
                    const fullSetting = getTransferSettingDetails(setting.id);
                    if (!fullSetting) return null;

                    return (
                      <div
                        key={setting.id}
                        className={`transfer-setting-card ${formData.transferSettingsId === setting.id ? 'selected' : ''}`}
                        onClick={() => setFormData(prev => ({ ...prev, transferSettingsId: setting.id }))}
                      >
                        <div className="transfer-setting-header">
                          <input
                            type="radio"
                            name="transferSettingsId"
                            value={setting.id}
                            checked={formData.transferSettingsId === setting.id}
                            onChange={() => {}}
                            required
                          />
                          <span className="transfer-setting-name">
                            {fullSetting.name}
                            {fullSetting.is_recommended && (
                              <span className="recommended-badge">Recommended</span>
                            )}
                          </span>
                        </div>
                        
                        <p className="transfer-setting-description">
                          {fullSetting.description}
                        </p>

                        <div className="metrics-grid">
                          <div className="metric-card">
                            <div className="metric-circle">
                              <svg viewBox="0 0 36 36" className="circular-chart">
                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path 
                                  className="circle quality" 
                                  strokeDasharray={`${fullSetting.quality_score}, 100`} 
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                />
                              </svg>
                              <div className="metric-number">{fullSetting.quality_score}</div>
                            </div>
                            <span className="metric-label">Quality</span>
                          </div>
                          <div className="metric-card">
                            <div className="metric-circle">
                              <svg viewBox="0 0 36 36" className="circular-chart">
                                <path className="circle-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                                <path 
                                  className="circle volume" 
                                  strokeDasharray={`${fullSetting.volume_score}, 100`} 
                                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
                                />
                              </svg>
                              <div className="metric-number">{fullSetting.volume_score}</div>
                            </div>
                            <span className="metric-label">Volume</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="numberOfBots">
                Number of Remote Agents <span className="required">*</span>
              </label>
              <input
                type="number"
                id="numberOfBots"
                name="numberOfBots"
                value={formData.numberOfBots}
                onChange={handleChange}
                placeholder="e.g., 10"
                min="1"
                max="1000"
                required
              />
              <small className="form-hint">Specify how many concurrent remote agents you need (1-1000)</small>
            </div>
          </section>

          {/* Integration Settings */}
          <section className="form-section">
            <div className="section-header">
              <i className="bi bi-hdd-network"></i>
              <h2>Integration Settings</h2>
            </div>

            <div className="form-group">
              <label>Dialler Configuration <span className="required">*</span></label>
              <div className="radio-group">
                <label className="radio-label">
                  <input
                    type="radio"
                    name="setupType"
                    value="same"
                    checked={formData.setupType === 'same'}
                    onChange={handleChange}
                  />
                  <span>Same Dialler</span>
                </label>
                <label className="radio-label">
                  <input
                    type="radio"
                    name="setupType"
                    value="separate"
                    checked={formData.setupType === 'separate'}
                    onChange={handleChange}
                  />
                  <span>Separate Closer Dialler</span>
                </label>
              </div>
            </div>

            <div className="integration-subsection">
              <h3 className="subsection-title">
                <i className="bi bi-gear-wide-connected"></i>
                Primary Dialler Settings
              </h3>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="primaryIpValidation">
                    IP Validation Link <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryIpValidation"
                    name="primaryIpValidation"
                    value={formData.primaryIpValidation}
                    onChange={handleChange}
                    placeholder="e.g., example.com"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="primaryAdminLink">
                    Admin Link <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryAdminLink"
                    name="primaryAdminLink"
                    value={formData.primaryAdminLink}
                    onChange={handleChange}
                    placeholder="e.g., your-dialer.com"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="primaryUser">
                    Username <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryUser"
                    name="primaryUser"
                    value={formData.primaryUser}
                    onChange={handleChange}
                    placeholder="Admin username"
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="primaryPassword">
                    Password <span className="required">*</span>
                  </label>
                  <input
                    type="password"
                    id="primaryPassword"
                    name="primaryPassword"
                    value={formData.primaryPassword}
                    onChange={handleChange}
                    placeholder="Admin password"
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="primaryBotsCampaign">
                    Primary Bots Campaign <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryBotsCampaign"
                    name="primaryBotsCampaign"
                    value={formData.primaryBotsCampaign}
                    onChange={handleChange}
                    placeholder="Enter primary bots campaign name"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="primaryUserSeries">
                    Primary User Series <span className="required">*</span>
                  </label>
                  <input
                    type="text"
                    id="primaryUserSeries"
                    name="primaryUserSeries"
                    value={formData.primaryUserSeries}
                    onChange={handleChange}
                    placeholder="Enter primary user series name"
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="primaryPort">
                  Port
                </label>
                <input
                  type="text"
                  id="primaryPort"
                  name="primaryPort"
                  value={formData.primaryPort}
                  onChange={handleChange}
                  placeholder="e.g., 7788"
                />
              </div>
            </div>

            {/* Closer Dialler Settings */}
            {formData.setupType === 'separate' && (
              <div className="integration-subsection closer-section">
                <h3 className="subsection-title">
                  <i className="bi bi-diagram-3"></i>
                  Closer Dialler Settings (Optional)
                </h3>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="closerIpValidation">
                      IP Validation Link
                    </label>
                    <input
                      type="text"
                      id="closerIpValidation"
                      name="closerIpValidation"
                      value={formData.closerIpValidation}
                      onChange={handleChange}
                      placeholder="e.g., example.com"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="closerAdminLink">
                      Admin Link
                    </label>
                    <input
                      type="text"
                      id="closerAdminLink"
                      name="closerAdminLink"
                      value={formData.closerAdminLink}
                      onChange={handleChange}
                      placeholder="e.g., closer-dialer.com"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="closerUser">
                      Username
                    </label>
                    <input
                      type="text"
                      id="closerUser"
                      name="closerUser"
                      value={formData.closerUser}
                      onChange={handleChange}
                      placeholder="Admin username"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="closerPassword">
                      Password
                    </label>
                    <input
                      type="password"
                      id="closerPassword"
                      name="closerPassword"
                      value={formData.closerPassword}
                      onChange={handleChange}
                      placeholder="Admin password"
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label htmlFor="closerCampaign">
                      Campaign
                    </label>
                    <input
                      type="text"
                      id="closerCampaign"
                      name="closerCampaign"
                      value={formData.closerCampaign}
                      onChange={handleChange}
                      placeholder="Closer campaign name"
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="closerIngroup">
                      Ingroup
                    </label>
                    <input
                      type="text"
                      id="closerIngroup"
                      name="closerIngroup"
                      value={formData.closerIngroup}
                      onChange={handleChange}
                      placeholder="Inbound group name"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="closerPort">
                    Port
                  </label>
                  <input
                    type="text"
                    id="closerPort"
                    name="closerPort"
                    value={formData.closerPort}
                    onChange={handleChange}
                    placeholder="e.g., 7788"
                  />
                </div>
              </div>
            )}
          </section>

          {/* Custom Requirements */}
          <section className="form-section">
            <div className="section-header">
              <i className="bi bi-chat-square-text"></i>
              <h2>Current Remote Agents</h2>
            </div>

            <div className="form-group">
              <label htmlFor="customRequirements">
                What company's remote agents are you currently using? (Optional)
              </label>
              <textarea
                id="customRequirements"
                name="customRequirements"
                value={formData.customRequirements}
                onChange={handleChange}
                rows="6"
              />
            </div>
          </section>

          {/* Submit Button */}
          <div className="form-actions">
            <button onClick={handleSubmit} className="submit-btn" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <i className="bi bi-hourglass-split"></i>
                  Submitting Request...
                </>
              ) : (
                <>
                  <i className="bi bi-send-fill"></i>
                  Submit Integration Request
                </>
              )}
            </button>
          </div>

          {/* Submit Message */}
          {submitMessage.text && (
            <div className={`submit-message ${submitMessage.type}`}>
              {submitMessage.type === 'success' && <i className="bi bi-check-circle-fill"></i>}
              {submitMessage.type === 'error' && <i className="bi bi-exclamation-circle-fill"></i>}
              {submitMessage.type === 'info' && <i className="bi bi-info-circle-fill"></i>}
              <span>{submitMessage.text}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IntegrationForm;
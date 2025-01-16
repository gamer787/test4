import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, DollarSign, CheckCircle, XCircle, AlertCircle, Loader, ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

type EligibilityCriteria = {
  minLinks: number;
  minPosts: number;
  minReels: number;
  minThreads: number;
  accountAge: number; // in days
  hasRequiredInfo: boolean;
};

export default function AccountMonetization() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [stats, setStats] = useState({
    linkCount: 0,
    postCount: 0,
    reelCount: 0,
    threadCount: 0,
    accountAge: 0,
    hasRequiredInfo: false
  });

  // Define eligibility criteria
  const criteria: EligibilityCriteria = {
    minLinks: 1000, // Updated to 1000 links
    minPosts: 30, // Regular posts
    minReels: 10, // Required reels
    minThreads: 20, // Required threads
    accountAge: 90, // 3 months
    hasRequiredInfo: true
  };

  useEffect(() => {
    if (user) {
      checkEligibility();
    }
  }, [user]);

  const checkEligibility = async () => {
    try {
      // Get user's link count
      // First get connections where user is user_id
      const { data: outgoingConnections, error: outgoingError } = await supabase
        .from('connections')
        .select('connected_user_id')
        .eq('user_id', user?.id)
        .eq('status', 'accepted');

      if (outgoingError) throw outgoingError;

      // Then get connections where user is connected_user_id
      const { data: incomingConnections, error: incomingError } = await supabase
        .from('connections')
        .select('user_id')
        .eq('connected_user_id', user?.id)
        .eq('status', 'accepted');

      if (incomingError) throw incomingError;

      // Combine and deduplicate connections
      const uniqueConnectedUsers = new Set([
        ...(outgoingConnections?.map(c => c.connected_user_id) || []),
        ...(incomingConnections?.map(c => c.user_id) || [])
      ]);

      // Get user's posts by type
      const { data: posts, error: postError } = await supabase
        .from('posts')
        .select('type')
        .eq('user_id', user?.id);

      if (postError) throw postError;

      // Count posts by type
      const postCount = posts?.filter(p => p.type === 'post').length || 0;
      const reelCount = posts?.filter(p => p.type === 'reel').length || 0;
      const threadCount = posts?.filter(p => p.type === 'thread').length || 0;

      // Get user's profile info
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('created_at, occupation, location, website, bio')
        .eq('id', user?.id)
        .single();

      if (profileError) throw profileError;

      // Calculate account age in days
      const createdAt = new Date(profile.created_at);
      const now = new Date();
      const accountAge = Math.floor((now.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

      // Check if user has all required profile info
      const hasRequiredInfo = Boolean(
        profile.occupation &&
        profile.location &&
        profile.website &&
        profile.bio
      );

      setStats({
        linkCount: uniqueConnectedUsers.size,
        postCount,
        reelCount,
        threadCount,
        accountAge,
        hasRequiredInfo
      });
    } catch (error) {
      console.error('Error checking eligibility:', error);
      setError('Failed to check eligibility status');
    } finally {
      setLoading(false);
    }
  };

  const isEligible = () => {
    return (
      stats.linkCount >= criteria.minLinks &&
      stats.postCount >= criteria.minPosts &&
      stats.reelCount >= criteria.minReels &&
      stats.threadCount >= criteria.minThreads &&
      stats.accountAge >= criteria.accountAge &&
      stats.hasRequiredInfo
    );
  };

  const handleApply = async () => {
    if (!isEligible()) return;
    setApplying(true);
    setError('');
    setSuccess('');

    try {
      // Update user's connections to provider status
      const { error: updateError } = await supabase
        .from('connections')
        .update({ status: 'provider' })
        .eq('user_id', user?.id)
        .eq('status', 'accepted');

      if (updateError) throw updateError;

      setSuccess('Your application has been submitted successfully! We will review your application and get back to you soon.');
    } catch (error) {
      console.error('Error applying for monetization:', error);
      setError('Failed to submit application. Please try again.');
    } finally {
      setApplying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-neon-blue"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center mb-6">
        <button
          onClick={() => navigate(-1)}
          className="mr-4 p-2 text-white/80 hover:text-white rounded-full hover:bg-white/10 transition-colors"
        >
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-bold text-white">Account Monetization</h1>
      </div>

      {/* Monetization Info */}
      <div className="gradient-bg rounded-lg border border-white/10 p-6 mb-6">
        <div className="flex items-center space-x-3 mb-4">
          <DollarSign className="w-8 h-8 text-neon-green" />
          <h2 className="text-xl font-semibold text-white">Monetize Your Links</h2>
        </div>
        <p className="text-white/80 mb-6">
          Turn your real-world connections into opportunities. Once eligible, you can offer premium content and services to your links.
        </p>

        {/* Monetization Flow */}
        <div className="space-y-6">
          <h3 className="text-lg font-semibold text-white">How Monetization Works</h3>
          <div className="grid grid-cols-1 gap-4">
            <div className="flex items-center space-x-4 bg-white/5 p-4 rounded-lg">
              <div className="w-10 h-10 bg-neon-blue/20 rounded-full flex items-center justify-center text-neon-blue">1</div>
              <div>
                <h4 className="font-medium text-white">Company Offers</h4>
                <p className="text-sm text-white/60">We connect you with companies looking to reach authentic audiences</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-white/30" />
            </div>
            <div className="flex items-center space-x-4 bg-white/5 p-4 rounded-lg">
              <div className="w-10 h-10 bg-neon-purple/20 rounded-full flex items-center justify-center text-neon-purple">2</div>
              <div>
                <h4 className="font-medium text-white">Review & Accept</h4>
                <p className="text-sm text-white/60">Choose which offers align with your audience and values</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-white/30" />
            </div>
            <div className="flex items-center space-x-4 bg-white/5 p-4 rounded-lg">
              <div className="w-10 h-10 bg-neon-pink/20 rounded-full flex items-center justify-center text-neon-pink">3</div>
              <div>
                <h4 className="font-medium text-white">Company Connection</h4>
                <p className="text-sm text-white/60">We facilitate direct communication between you and the companies</p>
              </div>
            </div>
            <div className="flex items-center justify-center">
              <ArrowRight className="w-6 h-6 text-white/30" />
            </div>
            <div className="flex items-center space-x-4 bg-white/5 p-4 rounded-lg">
              <div className="w-10 h-10 bg-neon-green/20 rounded-full flex items-center justify-center text-neon-green">4</div>
              <div>
                <h4 className="font-medium text-white">Earn Revenue</h4>
                <p className="text-sm text-white/60">Get paid for promoting products and services to your authentic connections</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Eligibility Criteria */}
      <div className="gradient-bg rounded-lg border border-white/10 p-6 mb-6">
        <h3 className="text-lg font-semibold text-white mb-4">Eligibility Criteria</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.linkCount >= criteria.minLinks ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Minimum {criteria.minLinks} Links</span>
            </div>
            <span className={`font-medium ${
              stats.linkCount >= criteria.minLinks ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.linkCount} / {criteria.minLinks}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.postCount >= criteria.minPosts ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Minimum {criteria.minPosts} Posts</span>
            </div>
            <span className={`font-medium ${
              stats.postCount >= criteria.minPosts ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.postCount} / {criteria.minPosts}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.reelCount >= criteria.minReels ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Minimum {criteria.minReels} Reels</span>
            </div>
            <span className={`font-medium ${
              stats.reelCount >= criteria.minReels ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.reelCount} / {criteria.minReels}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.threadCount >= criteria.minThreads ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Minimum {criteria.minThreads} Threads</span>
            </div>
            <span className={`font-medium ${
              stats.threadCount >= criteria.minThreads ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.threadCount} / {criteria.minThreads}
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.accountAge >= criteria.accountAge ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Account Age ({criteria.accountAge} days)</span>
            </div>
            <span className={`font-medium ${
              stats.accountAge >= criteria.accountAge ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.accountAge} days
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {stats.hasRequiredInfo ? (
                <CheckCircle className="w-5 h-5 text-neon-green" />
              ) : (
                <XCircle className="w-5 h-5 text-neon-pink" />
              )}
              <span className="text-white/80">Complete Profile Information</span>
            </div>
            <span className={`font-medium ${
              stats.hasRequiredInfo ? 'text-neon-green' : 'text-neon-pink'
            }`}>
              {stats.hasRequiredInfo ? 'Complete' : 'Incomplete'}
            </span>
          </div>
        </div>
      </div>

      {/* Error and Success Messages */}
      {error && (
        <div className="flex items-center space-x-2 text-neon-pink p-4 bg-neon-pink/10 rounded-lg mb-6">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="flex items-center space-x-2 text-neon-green p-4 bg-neon-green/10 rounded-lg mb-6">
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">{success}</p>
        </div>
      )}

      {/* Apply Button */}
      <button
        onClick={handleApply}
        disabled={!isEligible() || applying}
        className={`w-full flex items-center justify-center space-x-2 py-3 rounded-lg transition-colors ${
          isEligible()
            ? 'bg-neon-green text-white hover:bg-neon-green/90'
            : 'bg-white/10 text-white/50 cursor-not-allowed'
        }`}
      >
        {applying ? (
          <>
            <Loader className="w-5 h-5 animate-spin" />
            <span>Applying...</span>
          </>
        ) : (
          <>
            <DollarSign className="w-5 h-5" />
            <span>Apply for Monetization</span>
          </>
        )}
      </button>

      {!isEligible() && (
        <p className="text-white/50 text-sm text-center mt-4">
          Complete all eligibility criteria to apply for monetization
        </p>
      )}
    </div>
  );
}
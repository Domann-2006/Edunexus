import React, { useState, useEffect } from 'react';
import { Joyride, STATUS } from 'react-joyride';
import { useLocation } from 'react-router-dom';

interface OnboardingTourProps {
  user: any;
}

const TOUR_STORAGE_KEY = 'edunexus_onboarding_completed';

export default function OnboardingTour({ user }: OnboardingTourProps) {
  const [run, setRun] = useState(false);
  const location = useLocation();

  useEffect(() => {
    // Only run for SCHOOL_ADMIN on the Dashboard (/) and only if not completed before
    const isCompleted = localStorage.getItem(`${TOUR_STORAGE_KEY}_${user?.id}`);
    if (user?.role === 'SCHOOL_ADMIN' && !isCompleted && location.pathname === '/') {
      setRun(true);
    } else {
      setRun(false);
    }
  }, [user, location.pathname]);

  const steps: any[] = [
    {
      target: 'body',
      placement: 'center',
      content: (
        <div className="p-4">
          <h3 className="text-xl font-black text-blue-600 mb-3 tracking-tighter">Welcome to EduNexus! 🚀</h3>
          <p className="text-gray-600 font-medium leading-relaxed">
            Let's take a quick 1-minute tour to help you get the most out of your school management dashboard.
          </p>
        </div>
      ),
      disableBeacon: true,
    },
    {
      target: '#overview-header',
      placement: 'bottom',
      content: (
        <div className="p-2">
          <h4 className="font-bold text-gray-900 mb-1">Live Overview</h4>
          <p className="text-sm text-gray-500">Track your school's vital signs at a glance.</p>
        </div>
      ),
    },
    {
      target: '#stat-cards',
      placement: 'bottom',
      content: (
        <div className="p-2">
          <h4 className="font-bold text-gray-900 mb-1">Key Statistics</h4>
          <p className="text-sm text-gray-500">Quick totals for students, teachers, and classes.</p>
        </div>
      ),
    },
    {
      target: '#quick-actions',
      placement: 'left',
      content: (
        <div className="p-2">
          <h4 className="font-bold text-gray-900 mb-1">Fast Track Actions</h4>
          <p className="text-sm text-gray-500">Admit students or record results instantly from here.</p>
        </div>
      ),
    },
    {
      target: '#sidebar-nav',
      placement: 'right',
      content: (
        <div className="p-2">
          <h4 className="font-bold text-gray-900 mb-1">Navigation</h4>
          <p className="text-sm text-gray-500">Manage your entire school ecosystem from this menu.</p>
        </div>
      ),
    },
    {
      target: '#profile-section',
      placement: 'top',
      content: (
        <div className="p-2">
          <h4 className="font-bold text-gray-900 mb-1">Your Profile</h4>
          <p className="text-sm text-gray-500">Access your settings and log out safely here.</p>
        </div>
      ),
    }
  ];

  const handleJoyrideCallback = (data: any) => {
    const { status } = data;
    const finishedStatuses: string[] = [STATUS.FINISHED, STATUS.SKIPPED];

    if (finishedStatuses.includes(status)) {
      setRun(false);
      localStorage.setItem(`${TOUR_STORAGE_KEY}_${user?.id}`, 'true');
    }
  };

  return (
    <Joyride
      {...({
        steps,
        run,
        continuous: true,
        showProgress: true,
        showSkipButton: true,
        callback: handleJoyrideCallback,
        styles: {
          options: {
            primaryColor: '#2563eb', // blue-600
            zIndex: 1000,
            backgroundColor: '#ffffff',
            arrowColor: '#ffffff',
            textColor: '#1f2937', // gray-800
          },
          tooltipContainer: {
            textAlign: 'left',
            borderRadius: '24px',
            padding: '10px',
          },
          buttonNext: {
            borderRadius: '12px',
            padding: '10px 20px',
            fontSize: '12px',
            fontWeight: '900',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          },
          buttonBack: {
            fontSize: '12px',
            fontWeight: '700',
            color: '#94a3b8', // gray-400
          },
          buttonSkip: {
            fontSize: '12px',
            fontWeight: '700',
            color: '#94a3b8',
          }
        }
      } as any)}
    />
  );
}

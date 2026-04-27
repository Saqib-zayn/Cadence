import AppLayout from './AppLayout';

export default function ProgressScreen() {
  return (
    <AppLayout title="Progress">
      <div className="pt-[32px] md:pt-[48px] max-w-[600px]">
        <div className="bg-surface border border-border rounded-lg p-[20px] shadow-sm">
          <p className="text-body text-text-secondary">
            Complete a few rounds to see your progress here.
          </p>
        </div>
      </div>
    </AppLayout>
  );
}

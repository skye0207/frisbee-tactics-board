import TacticEditor from '@/components/TacticEditor';

export default async function TacticPage({ params }) {
  const { id } = await params;
  return <TacticEditor tacticId={id} />;
}

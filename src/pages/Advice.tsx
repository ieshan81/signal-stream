import { LayoutShell } from '@/components/LayoutShell';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Advice() {
  const navigate = useNavigate();

  return (
    <LayoutShell>
      <div className="space-y-6">
        <div>
          <h2 className="text-3xl font-bold">Personalized Advice</h2>
          <p className="text-muted-foreground">AI-powered recommendations based on your portfolio</p>
        </div>

        <Card>
          <CardContent className="py-12 text-center">
            <Lightbulb className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-6">
              Add positions to your portfolio to receive personalized trading recommendations
              based on our quant strategies.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={() => navigate('/portfolio')}>
                Go to Portfolio
              </Button>
              <Button variant="outline" onClick={() => navigate('/watchlist')}>
                View Watchlist
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </LayoutShell>
  );
}

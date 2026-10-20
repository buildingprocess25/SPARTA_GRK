'use client';

import React from 'react';
import { Card } from '@/components/ui/card';

export default function CardBox({ children, className = '', spotlight: _spotlight, ...props }: { children?: any; className?: string; spotlight?: any; [key: string]: any }) {
  return (
    <Card className={className} {...props}>
      {children}
    </Card>
  );
}

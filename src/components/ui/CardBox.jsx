'use client';

import React from 'react';
import { Card } from '@/components/ui/card';

export default function CardBox({ children, className = '', spotlight: _spotlight, ...props }) {
  return (
    <Card className={className} {...props}>
      {children}
    </Card>
  );
}

import React from 'react';
import { cn } from '../../lib/utils';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  width?: string | number;
  height?: string | number;
  borderRadius?: string;
}

const Skeleton = ({ className, width, height, borderRadius }: SkeletonProps) => {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ 
        opacity: [0.5, 0.8, 0.5],
      }}
      transition={{ 
        duration: 2, 
        repeat: Infinity, 
        ease: "easeInOut" 
      }}
      className={cn(
        "relative overflow-hidden bg-[#1E1E1E] before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-[#2A2A2A] before:to-transparent",
        className
      )}
      style={{ 
        width, 
        height, 
        borderRadius: borderRadius || '0.5rem' 
      }}
    />
  );
};

export default Skeleton;

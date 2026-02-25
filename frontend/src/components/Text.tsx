import { ComponentPropsWithoutRef, ElementType, ReactNode } from 'react';

type TextVariant =
  | 'display-cinematic'
  | 'display-chapter'
  | 'label-subtle'
  | 'track-title-elegant'
  | 'body-editorial'
  | 'metadata-soft';

interface TextProps<T extends ElementType> {
  as?: T;
  variant: TextVariant;
  className?: string;
  children: ReactNode;
}

const variantToDefaultTag: Record<TextVariant, ElementType> = {
  'display-cinematic': 'h1',
  'display-chapter': 'h2',
  'label-subtle': 'p',
  'track-title-elegant': 'p',
  'body-editorial': 'p',
  'metadata-soft': 'p',
};

export const Text = <T extends ElementType = 'p'>(props: TextProps<T> & Omit<ComponentPropsWithoutRef<T>, keyof TextProps<T>>) => {
  const { as, variant, className = '', children, ...rest } = props;
  const Tag = (as ?? variantToDefaultTag[variant]) as ElementType;
  const mergedClassName = className ? `${variant} ${className}` : variant;

  return (
    <Tag className={mergedClassName} {...rest}>
      {children}
    </Tag>
  );
};

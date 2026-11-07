import React from 'react';
import { Text, View } from 'react-native';

interface ErrorBoundaryProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={{ fontSize: 16, marginBottom: 8 }}>Something went wrong</Text>
        <Text style={{ fontSize: 13, opacity: 0.7, textAlign: 'center' }}>{this.state.message}</Text>
      </View>
    );
  }
}

export default ErrorBoundary;

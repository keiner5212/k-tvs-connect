import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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
    return { hasError: true, message: error.name };
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 }}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>Restart the app. If it keeps happening, reinstall the app.</Text>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  body: {
    fontSize: 13,
    opacity: 0.7,
    textAlign: 'center',
  },
  title: {
    fontSize: 16,
    marginBottom: 8,
  },
});

export default ErrorBoundary;

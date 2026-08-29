import { Component } from 'react'
import ErrorState from './ErrorState'

export default class SectionErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error(`[${this.props.componentName || 'section'}] render error`, error, info)
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorState
          componentName={this.props.componentName}
          error={this.state.error}
          onRetry={() => this.setState({ error: null })}
        />
      )
    }
    return this.props.children
  }
}
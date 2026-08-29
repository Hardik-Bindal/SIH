import SectionErrorBoundary from './SectionErrorBoundary'
import ErrorState from './ErrorState'

export default function AsyncSection({
  query,
  componentName,
  skeleton,
  isEmpty,
  empty,
  children,
}) {
  const { isPending, isError, error, refetch, data } = query

  let content
  if (isPending) {
    content = skeleton
  } else if (isError) {
    content = <ErrorState componentName={componentName} error={error} onRetry={refetch} />
  } else if (isEmpty ? isEmpty(data) : false) {
    content = empty
  } else {
    content = <div className="animate-fade-in">{children(data)}</div>
  }

  return <SectionErrorBoundary componentName={componentName}>{content}</SectionErrorBoundary>
}
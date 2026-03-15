import styled from 'styled-components';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100dvh;
  color: ${({ theme }) => theme.colors.foreground};
  gap: ${({ theme }) => theme.spacing.md};
`;

const Checkmark = styled.div`
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.success};
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  color: ${({ theme }) => theme.colors.white};
`;

const Message = styled.p`
  font-size: 1.1rem;
  opacity: 0.8;
`;

export function AuthCallbackPage() {
  return (
    <Container>
      <Checkmark aria-hidden>&#10003;</Checkmark>
      <h2>Authentication complete</h2>
      <Message>Closing automatically&hellip;</Message>
    </Container>
  );
}

// Intentional undeclared variable fixture to prove eslint no-undef rule works
export function testUndefinedVariable() {
  const result = undeclaredVariableXYZ + 123;
  return result;
}

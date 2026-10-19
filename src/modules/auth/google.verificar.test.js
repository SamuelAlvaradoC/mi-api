// Verificación del ID token de Google: audiencia, emisor, vencimiento
// (verifyIdToken) y email_verified. Sin GOOGLE_CLIENT_ID no está disponible.
const mockVerify = jest.fn();
jest.mock('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({ verifyIdToken: mockVerify })),
}));
const { verificarCredencial, disponible } = require('./google');

const ID = 'cliente-web.apps.googleusercontent.com';
const payload = (o) => ({ iss: 'https://accounts.google.com', aud: ID, sub: '123', email: 'Ana@Gmail.com', email_verified: true, name: 'Ana', ...o });
const conPayload = (p) => mockVerify.mockResolvedValue({ getPayload: () => p });

beforeEach(() => { mockVerify.mockReset(); process.env.GOOGLE_CLIENT_ID = ID; });
afterAll(() => { delete process.env.GOOGLE_CLIENT_ID; });

test('token válido: devuelve sub, correo en minúscula y nombre; verifica con la audiencia correcta', async () => {
  conPayload(payload());
  await expect(verificarCredencial('tok')).resolves.toEqual({ sub: '123', email: 'ana@gmail.com', nombre: 'Ana' });
  expect(mockVerify).toHaveBeenCalledWith({ idToken: 'tok', audience: ID });
});

test.each([
  ['correo sin verificar', payload({ email_verified: false })],
  ['otro emisor', payload({ iss: 'https://evil.example.com' })],
  ['otra audiencia', payload({ aud: 'otra-app' })],
])('%s: 401', async (_, p) => {
  conPayload(p);
  await expect(verificarCredencial('tok')).rejects.toMatchObject({ status: 401 });
});

test('firma inválida o vencido (verifyIdToken falla): 401', async () => {
  mockVerify.mockRejectedValue(new Error('Token used too late'));
  await expect(verificarCredencial('tok')).rejects.toMatchObject({ status: 401 });
});

test('sin GOOGLE_CLIENT_ID: no disponible (503) y ni se intenta verificar', async () => {
  delete process.env.GOOGLE_CLIENT_ID;
  expect(disponible()).toBe(false);
  await expect(verificarCredencial('tok')).rejects.toMatchObject({ status: 503 });
  expect(mockVerify).not.toHaveBeenCalled();
});

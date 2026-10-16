import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { LoginApi, LoginRequest, LoginResponse } from './login-api';
import { LoginSession } from './login-session';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  let login: ReturnType<typeof vi.fn>;
  let fixture: ReturnType<typeof TestBed.createComponent<LoginPage>>;
  let session: LoginSession;

  function setInput(id: string, value: string): void {
    const input = fixture.nativeElement.querySelector(`#${id}`) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input'));
    fixture.detectChanges();
  }

  function setSelect(id: string, value: string): void {
    const select = fixture.nativeElement.querySelector(`#${id}`) as HTMLSelectElement;
    select.value = value;
    select.dispatchEvent(new Event('change'));
    fixture.detectChanges();
  }

  function submit(): void {
    (fixture.nativeElement.querySelector('button[type="submit"]') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function fillForm(document: string, documentType = 'DNI'): void {
    setSelect('documentType', documentType);
    setInput('document', document);
    setInput('password', 'test-password');
  }

  beforeEach(async () => {
    login = vi.fn();
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [{ provide: LoginApi, useValue: { login } }, LoginSession, provideRouter([])],
    }).compileComponents();
    fixture = TestBed.createComponent(LoginPage);
    session = TestBed.inject(LoginSession);
    fixture.detectChanges();
  });

  it('offers only DNI/CE and keeps the document control as text', () => {
    const select = fixture.nativeElement.querySelector('#documentType') as HTMLSelectElement;
    const document = fixture.nativeElement.querySelector('#document') as HTMLInputElement;

    expect(Array.from(select.options).map((option) => option.value)).toEqual(['DNI', 'CE']);
    expect(document.type).toBe('text');
  });

  it('requires a document value before sending login', () => {
    fillForm('');
    submit();

    expect(login).not.toHaveBeenCalled();
    expect(fixture.nativeElement.textContent).toContain('obligatorio');
  });

  it('starts an in-memory session for a successful W0 account response', () => {
    const response: LoginResponse = {
      access_token: 'fake-access-token',
      token_type: 'Bearer',
      expires_in: 3600,
      account_id: 'account-001',
    };
    login.mockReturnValue(of(response));
    fillForm('00000001', 'CE');
    submit();

    const expectedRequest: LoginRequest = {
      documentType: 'CE',
      document: '00000001',
      password: 'test-password',
    };
    expect(login).toHaveBeenCalledWith(expectedRequest);
    expect(fixture.nativeElement.textContent).toContain('¡Hola! Qué bueno verte.');
    expect(fixture.nativeElement.textContent).toContain('Wali');
    expect(fixture.nativeElement.textContent).toContain('account-001');
    expect(fixture.nativeElement.querySelector('a[href="/payments/new"]')?.textContent).toContain('Crear pago');
    expect(fixture.nativeElement.querySelector('a[href="/payments/history"]')?.textContent).toContain('Ver historial');
    expect(fixture.nativeElement.textContent).not.toContain('fake-access-token');
    expect(session.session()?.accountId).toBe('account-001');
  });

  it('uses a generic message for invalid credentials and hides backend details', () => {
    login.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 401,
      error: { message: 'sensitive backend detail' },
    })));
    fillForm('00000003');
    submit();

    const text = fixture.nativeElement.textContent as string;
    expect(text).toContain('Documento o contraseña incorrectos.');
    expect(text).not.toContain('sensitive backend detail');
  });
});

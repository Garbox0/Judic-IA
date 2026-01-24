import { redirect } from 'next/navigation';

export default function ConsultasIndex() {
    // Si entran a la raíz del subdominio, mandarlos al login
    redirect('/auth/login');
}

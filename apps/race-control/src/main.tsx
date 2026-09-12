// Compatibility preview; the application source now belongs to veetr.org.
import React from 'react';
import {createRoot} from 'react-dom/client';
import {useRegisterSW} from 'virtual:pwa-register/react';
import App from '../../../veetr.org/src/features/racing/main';
import '../../../veetr.org/src/features/racing/style.css';
import '../../../veetr.org/src/features/racing/theme.css';
function Preview() {
 const {needRefresh:[updateAvailable],updateServiceWorker}=useRegisterSW();
 return <App updateAvailable={updateAvailable} updateServiceWorker={updateServiceWorker} />;
}
createRoot(document.getElementById('root')!).render(<Preview />);

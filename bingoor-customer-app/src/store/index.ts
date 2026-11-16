import { configureStore } from '@reduxjs/toolkit';
import { catalogApi } from './catalogApi';

/** The app's Redux store. Server data lives in RTK Query slices. */
export const store = configureStore({
  reducer: { [catalogApi.reducerPath]: catalogApi.reducer },
  middleware: getDefault => getDefault().concat(catalogApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

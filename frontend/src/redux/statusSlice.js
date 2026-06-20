import { createSlice } from '@reduxjs/toolkit'

const initialState = {
  statuses: [],
  myStatuses: []
}

const statusSlice = createSlice({
  name: 'status',
  initialState,
  reducers: {
    setStatuses: (state, action) => {
      state.statuses = action.payload
    },
    setMyStatuses: (state, action) => {
      state.myStatuses = action.payload
    },
    addMyStatus: (state, action) => {
      state.myStatuses = [action.payload, ...state.myStatuses]
    }
  }
})

export const { setStatuses, setMyStatuses, addMyStatus } = statusSlice.actions
export default statusSlice.reducer

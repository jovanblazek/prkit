declare module 'prompts' {
  export interface PromptObject {
    type: string
    name: string
    message: string
    initial?: boolean
  }

  export interface PromptResponse {
    confirmed?: boolean
  }

  export default function prompts(prompt: PromptObject): Promise<PromptResponse>
}

<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use App\Http\Requests\Auth\RefreshRequest;
use App\Http\Requests\Auth\RegisterRequest;
use App\Http\Resources\UserResource;
use App\Models\RefreshToken;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function register(RegisterRequest $request): UserResource
    {
        $user = DB::transaction(function () use ($request): User {
            $creatorId = User::query()->orderBy('id')->value('id');

            $user = User::create([
                'name' => $request->string('name')->toString(),
                'email' => $request->string('email')->toString(),
                'password' => $request->string('password')->toString(),
                'role' => User::ROLE_ADMIN,
                'created_by' => $creatorId,
            ]);

            if ($creatorId === null) {
                $user->forceFill(['created_by' => $user->id])->save();
            }

            return $user;
        });

        return new UserResource($user);
    }

    public function login(LoginRequest $request): JsonResponse
    {
        $user = User::query()
            ->where('email', $request->string('email')->toString())
            ->first();

        if (! $user || ! Hash::check($request->string('password')->toString(), $user->password)) {
            return response()->json([
                'detail' => 'Invalid credentials',
            ], 401);
        }

        [$accessToken, $refreshToken] = $this->issueTokens($user);

        return response()->json([
            'access_token' => $accessToken,
            'refresh_token' => $refreshToken,
            'token_type' => 'bearer',
        ]);
    }

    public function refresh(RefreshRequest $request): JsonResponse
    {
        $rawRefreshToken = $request->string('refresh_token')->toString();
        $refreshToken = RefreshToken::query()
            ->where('token_hash', hash('sha256', $rawRefreshToken))
            ->where('revoked', false)
            ->where('expires_at', '>', now())
            ->first();

        if (! $refreshToken) {
            return response()->json([
                'detail' => 'Invalid or expired refresh token',
            ], 401);
        }

        $user = User::query()->find($refreshToken->user_id);
        if (! $user) {
            return response()->json([
                'detail' => 'User not found',
            ], 401);
        }

        $accessToken = $user->createToken('api-access')->plainTextToken;

        return response()->json([
            'access_token' => $accessToken,
            'token_type' => 'bearer',
        ]);
    }

    public function logout(RefreshRequest $request, Request $authRequest): JsonResponse
    {
        /** @var User $currentUser */
        $currentUser = $authRequest->user();

        RefreshToken::query()
            ->where('token_hash', hash('sha256', $request->string('refresh_token')->toString()))
            ->where('user_id', $currentUser->id)
            ->update([
                'revoked' => true,
                'updated_at' => now(),
            ]);

        $currentUser->currentAccessToken()?->delete();

        return response()->json(null, 204);
    }

    public function me(Request $request): UserResource
    {
        /** @var User $user */
        $user = $request->user();

        return new UserResource($user);
    }

    /**
     * @return array{0: string, 1: string}
     */
    private function issueTokens(User $user): array
    {
        $accessToken = $user->createToken('api-access')->plainTextToken;
        $rawRefreshToken = Str::random(96);

        RefreshToken::query()->create([
            'user_id' => $user->id,
            'created_by' => $user->id,
            'token_hash' => hash('sha256', $rawRefreshToken),
            'expires_at' => now()->addDays(7),
            'revoked' => false,
        ]);

        return [$accessToken, $rawRefreshToken];
    }
}
